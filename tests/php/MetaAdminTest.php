<?php
/** @package PixelPair */
use PixelPair\Admin\MetaController;
use PixelPair\Logs\Controller;
use PixelPair\Events\Tables;
use PixelPair\Settings\Secrets;

final class MetaAdminTest extends LifecycleTestCase {
	public function test_identity_is_private_consent_gated_and_contains_only_matching_hashes(): void {
		$controller=new \PixelPair\Events\CollectorController();
		$this->assertTrue(method_exists($controller,'identity'),'Browser matching endpoint missing.');
		\PixelPair\Activation::activate(false);
		(new \PixelPair\Settings\Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_advanced_matching'=>true));
		$admin=get_users(array('role'=>'administrator','number'=>1))[0];
		$saved=$_COOKIE; $_COOKIE[LOGGED_IN_COOKIE]=wp_generate_auth_cookie($admin->ID,time()+600,'logged_in'); $_SERVER['REQUEST_METHOD']='POST';
		$request=new WP_REST_Request('POST','/pixelpair/v1/identity');$request->set_header('Origin',home_url());
		$request->set_body(wp_json_encode(array('url'=>home_url('/'),'consent'=>array('source'=>'default','granted'=>true))));
		try {
			$response=$controller->identity($request);$this->assertSame(200,$response->get_status());
			$this->assertSame(hash('sha256',strtolower($admin->user_email)),((array)$response->get_data()['matching'])['em']);
			$this->assertStringNotContainsString($admin->user_email,wp_json_encode($response->get_data()));
			$this->assertStringContainsString('no-store',$response->get_headers()['Cache-Control']);
			$request->set_header('Origin','https://evil.example');$this->assertSame(403,$controller->identity($request)->get_status());
		} finally {$_COOKIE=$saved;}
	}
	protected function tearDown(): void { delete_option('pixelpair_secrets'); if(class_exists(Tables::class)){Tables::clear();} parent::tearDown(); }
	public function test_credentials_and_logs_require_nonce_and_capability(): void {
		$this->assertTrue(class_exists(MetaController::class),'CAPI admin controller missing.');
		\PixelPair\Activation::activate(false); Tables::install();
		$server=rest_get_server();
		foreach(array('/pixelpair/v1/meta','/pixelpair/v1/logs') as $path){$this->assertSame(403,$server->dispatch(new WP_REST_Request('GET',$path))->get_status());}
		$admin=get_users(array('role'=>'administrator','number'=>1))[0];wp_set_current_user($admin->ID);
		(new Secrets())->update(array('token'=>'EAAtest_secret_12345'));
		$request=new WP_REST_Request('GET','/pixelpair/v1/meta');$request->set_header('X-WP-Nonce',wp_create_nonce('wp_rest'));
		$response=$server->dispatch($request);$this->assertSame(200,$response->get_status());$this->assertTrue($response->get_data()['token_set']);
		$this->assertStringNotContainsString('EAAtest',wp_json_encode($response->get_data()));
		$test=new WP_REST_Request('POST','/pixelpair/v1/meta/test');$test->set_header('X-WP-Nonce',wp_create_nonce('wp_rest'));
		$this->assertSame(400,$server->dispatch($test)->get_status(),'Live test dispatch requires an active test code.');
	}
}
