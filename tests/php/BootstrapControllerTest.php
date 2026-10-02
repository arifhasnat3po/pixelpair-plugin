<?php
/** @package PixelPair */
use PixelPair\Events\BootstrapController;
use PixelPair\Settings\Repository;

final class BootstrapControllerTest extends LifecycleTestCase {
	private $server;
	protected function setUp(): void { parent::setUp(); $this->server=$_SERVER; $this->assertTrue(class_exists(BootstrapController::class),'Gate not implemented.'); $_SERVER['REMOTE_ADDR']='203.0.113.10'; $_SERVER['HTTP_USER_AGENT']='Mozilla/5.0'; add_filter('pixelpair_bootstrap_rate_limit',static function(){return 10000;}); }
	protected function tearDown(): void {$_SERVER=$this->server;remove_all_filters('pixelpair_bootstrap_rate_limit');remove_all_filters('pixelpair_consent_tools');parent::tearDown();}
	private function body(array $extra=array()): string {return wp_json_encode(array_merge(array('url'=>home_url('/'),'consent'=>array('granted'=>true,'source'=>'default')),$extra));}
	private function send(string $body, ?string $origin=null, string $method='POST'){return (new BootstrapController())->evaluate($body,$origin??home_url(),$method);}
	public function test_platform_filter_is_honored_by_fresh_gate_decisions(): void {
		(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
		$filter=static function(){return array();};add_filter('pixelpair_platforms',$filter);
		try{$this->assertFalse($this->send($this->body())['meta']['enabled']);}finally{remove_filter('pixelpair_platforms',$filter);}
	}
	public function test_guest_and_authenticated_decisions_use_current_state_and_only_public_fields(): void {
		(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','excluded_roles'=>array('subscriber')));
		$this->assertSame(array('allowed'=>true,'marketing_allowed'=>true,'meta'=>array('enabled'=>true,'pixel_id'=>'123456789012345')),$this->send($this->body()));
		$user=get_users(array('role'=>'subscriber','number'=>1))[0];wp_set_current_user($user->ID);
		$this->assertFalse($this->send($this->body())['allowed']);
		wp_set_current_user(0);(new Repository())->update(array('excluded_ips'=>array('203.0.113.0/24')));
		$this->assertFalse($this->send($this->body())['allowed']);
	}
	public function test_invalid_origin_method_body_and_spoofed_identity_are_rejected(): void {
		foreach(array($this->body(array('roles'=>array())), $this->body(array('ip'=>'127.0.0.1')), $this->body(array('url'=>'https://evil.example/')), '{bad', '[]', str_repeat('x',8193), $this->body(array('consent'=>array('granted'=>'true','source'=>'default')))) as $body){$this->assertInstanceOf(WP_Error::class,$this->send($body));}
		$this->assertInstanceOf(WP_Error::class,$this->send($this->body(),'https://evil.example'));
		$this->assertInstanceOf(WP_Error::class,$this->send($this->body(),'null'));
		$this->assertInstanceOf(WP_Error::class,$this->send($this->body(),home_url(),'GET'));
	}
	public function test_unresolved_cmp_and_force_denied_override_default_browser_grant(): void {
		(new Repository())->update(array('deny_until_consent'=>true));
		$this->assertFalse($this->send($this->body())['marketing_allowed']);
		$this->assertTrue($this->send($this->body(array('consent'=>array('granted'=>true,'source'=>'integration'))))['marketing_allowed']);
		(new Repository())->update(array('deny_until_consent'=>false));
		add_filter('pixelpair_consent_tools',static function(){return array('cookiebot');});
		$this->assertFalse($this->send($this->body())['marketing_allowed']);
		$this->assertTrue($this->send($this->body(array('consent'=>array('granted'=>true,'source'=>'cookiebot'))))['marketing_allowed']);
	}
	public function test_rate_limit_is_enforced_and_responses_are_not_cacheable(): void {
		remove_all_filters('pixelpair_bootstrap_rate_limit');add_filter('pixelpair_bootstrap_rate_limit',static function(){return 1;}); $_SERVER['REMOTE_ADDR']='203.0.113.222';
		\PixelPair\Support\RateLimiter::clear('203.0.113.222');
		$this->assertIsArray($this->send($this->body()));
		$result=$this->send($this->body());$this->assertInstanceOf(WP_Error::class,$result);$this->assertSame(429,$result->get_error_data()['status']);
		$this->assertStringContainsString('no-store',BootstrapController::headers()['Cache-Control']);
		$this->assertFalse(has_filter('wp_ajax_pixelpair_bootstrap')===false);$this->assertFalse(has_filter('wp_ajax_nopriv_pixelpair_bootstrap')===false);
	}
}
