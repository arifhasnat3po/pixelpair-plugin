<?php
/** @package PixelPair */
use PixelPair\Exclusions\IpMatcher;
use PixelPair\Exclusions\ExclusionManager;
use PixelPair\Exclusions\BotDetector;
use PixelPair\Exclusions\ContextDetector;
use PixelPair\Settings\Repository;
use PixelPair\Support\Request;

final class ExclusionsTest extends LifecycleTestCase {
	private $server;
	protected function setUp(): void { parent::setUp(); $this->server = $_SERVER; $this->assertTrue( class_exists( ExclusionManager::class ), 'Exclusions not implemented.' ); }
	protected function tearDown(): void { $_SERVER = $this->server; remove_all_filters( 'pixelpair_should_track' ); remove_all_filters( 'pixelpair_bot_user_agents' ); remove_all_filters( 'pixelpair_cache_preloaders' ); parent::tearDown(); }
	/** @dataProvider ranges */
	public function test_ip_boundaries( string $ip, string $range, bool $matches ): void { $this->assertSame( $matches, IpMatcher::matches( $ip, $range ) ); }
	public static function ranges(): array { return array(
		array('192.0.2.0','192.0.2.0/24',true), array('192.0.2.255','192.0.2.0/24',true), array('192.0.3.0','192.0.2.0/24',false), array('192.0.2.2','192.0.2.1',false), array('192.0.2.1','192.0.2.1/32',true), array('255.255.255.255','0.0.0.0/0',true),
		array('2001:db8::','2001:db8::/32',true), array('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff','2001:db8::/32',true), array('2001:db9::','2001:db8::/32',false), array('::1','0:0:0:0:0:0:0:1',true), array('::1','::/127',true), array('::2','::/127',false), array('::ffff:192.0.2.1','192.0.2.0/24',false), array('::1','::1/129',false), array('bad','::/0',false)
	); }
	public function test_roles_and_remote_ip_cannot_be_spoofed_by_forwarded_headers(): void {
		(new Repository())->update(array('excluded_roles'=>array('subscriber'),'excluded_ips'=>array('192.0.2.0/24')));
		$_SERVER['REMOTE_ADDR']='192.0.2.5'; $_SERVER['HTTP_X_FORWARDED_FOR']='203.0.113.1';
		$this->assertSame('192.0.2.5',Request::client_ip());
		$this->assertFalse((new ExclusionManager())->should_track(home_url('/')));
		$_SERVER['REMOTE_ADDR']='203.0.113.1';
		$user=get_users(array('role'=>'subscriber','number'=>1))[0]; wp_set_current_user($user->ID);
		$this->assertFalse((new ExclusionManager())->should_track(home_url('/')));
		wp_set_current_user(0); $this->assertTrue((new ExclusionManager())->should_track(home_url('/')));
		add_filter('pixelpair_should_track','__return_false');
		$this->assertFalse((new ExclusionManager())->should_track(home_url('/')));
	}
	public function test_bot_filters_and_cache_preloaders(): void {
		$this->assertTrue(BotDetector::is_bot('Mozilla Googlebot/2.1'));
		$this->assertFalse(BotDetector::is_bot('Mozilla/5.0 Chrome/130.0'));
		add_filter('pixelpair_bot_user_agents',static function($list){$list[]='custom-agent';return $list;});
		$this->assertTrue(BotDetector::is_bot('Custom-Agent/1'));
		$this->assertTrue(BotDetector::is_preloader('WP Rocket/Preload'));
		add_filter('pixelpair_cache_preloaders',static function($list){$list[]='my-preloader';return $list;});
		$this->assertTrue(BotDetector::is_preloader('my-preloader'));
	}
	/** @dataProvider contexts */
	public function test_excluded_url_contexts( string $path ): void { $this->assertTrue((new ContextDetector())->excluded_url(home_url($path))); }
	public static function contexts(): array { return array_map(static function($s){return array($s);},array('/wp-admin/','/wp-json/wp/v2/posts','/?rest_route=/wp/v2/posts','/?preview=true','/?elementor-preview=12','/?et_fb=1','/?bricks=run','/?ct_builder=true','/?fl_builder','/?amp=1','/sample/amp/','/wp-cron.php','/wp-login.php')); }
	public function test_normal_page_is_not_excluded_and_core_preview_is(): void {
		$detector=new ContextDetector(); $this->assertFalse($detector->excluded_url(home_url('/?utm_source=test')));
		global $wp_query; $before=$wp_query->is_preview; $wp_query->is_preview=true;
		try{$this->assertTrue($detector->is_excluded());}finally{$wp_query->is_preview=$before;}
	}
}
