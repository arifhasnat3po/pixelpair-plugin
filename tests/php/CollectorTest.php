<?php
/** @package PixelPair */
use PixelPair\Events\CollectorController;
use PixelPair\Events\Tables;
use PixelPair\Settings\Repository;
use PixelPair\Settings\Secrets;
use PixelPair\Support\RateLimiter;

final class CollectorTest extends LifecycleTestCase {
	private $cookies;
	protected function setUp(): void {
		parent::setUp(); $this->cookies=$_COOKIE; $_SERVER['REQUEST_METHOD']='POST';
		$this->assertTrue(class_exists(CollectorController::class),'Public event collector missing.');
		Tables::install(); Tables::clear(); RateLimiter::clear('127.0.0.1','event');
		(new Repository())->update(array('meta_enabled'=>true,'meta_capi_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
		(new Secrets())->update(array('token'=>'EAAtest_secret_12345'));
	}
	protected function tearDown(): void { $_COOKIE=$this->cookies ?? array(); if(class_exists(Tables::class)) { Tables::clear(); } delete_option('pixelpair_secrets'); parent::tearDown(); }
	private function body(array $changes=array()): string { return wp_json_encode(array_replace(array('event_name'=>'page_view','expected_name'=>'PageView','event_id'=>'12345678-1234-4234-8234-123456789012','params'=>(object)array(),'source_url'=>home_url('/'),'consent'=>array('granted'=>true,'source'=>'default')),$changes)); }
	public function test_permitted_events_queue_once_and_acknowledge_no_identity(): void {
		$controller=new CollectorController();
		$one=$controller->evaluate($this->body(),home_url(),'POST');
		$two=$controller->evaluate($this->body(),home_url(),'POST');
		$this->assertSame(array('accepted'=>true),$one);
		$this->assertSame($one,$two);
		global $wpdb; $rows=$wpdb->get_results("SELECT * FROM {$wpdb->prefix}pixelpair_jobs",ARRAY_A);
		$this->assertCount(1,$rows);
		$this->assertStringNotContainsString('client_ip_address',$rows[0]['payload']);
		$this->assertStringNotContainsString('127.0.0.1',$rows[0]['payload']);
	}
	public function test_denial_unknown_events_bad_origin_and_size_create_no_job_or_cookies(): void {
		$_COOKIE=array(); $controller=new CollectorController();
		foreach(array($this->body(array('consent'=>array('granted'=>false,'source'=>'integration'))),$this->body(array('event_name'=>'purchase')),$this->body(array('event_id'=>'bad')),$this->body(array('user_data'=>array('em'=>'stolen'))),str_repeat('x',16385)) as $body) { $this->assertInstanceOf(WP_Error::class,$controller->evaluate($body,home_url(),'POST')); }
		$this->assertInstanceOf(WP_Error::class,$controller->evaluate($this->body(),'https://evil.example','POST'));
		$this->assertSame(array(),$_COOKIE);
		global $wpdb; $this->assertSame('0',(string)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}pixelpair_jobs"));
	}
	public function test_logged_in_cookie_roles_cannot_be_bypassed_by_nonce_free_rest(): void {
		$admin=get_users(array('role'=>'administrator','number'=>1))[0];
		$_COOKIE[LOGGED_IN_COOKIE]=wp_generate_auth_cookie($admin->ID,time()+600,'logged_in');
		wp_set_current_user(0);
		(new Repository())->update(array('excluded_roles'=>array('administrator')));
		$this->assertInstanceOf(WP_Error::class,(new CollectorController())->evaluate($this->body(),home_url(),'POST'));
		$this->assertSame(0,get_current_user_id(),'Public collector must restore global authentication.');
	}
}
