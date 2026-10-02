<?php
/** @package PixelPair */
use PixelPair\Events\EventManager;
use PixelPair\Settings\Repository;

final class FrontConfigTest extends LifecycleTestCase {
	private $server;
	protected function setUp(): void {parent::setUp();$this->server=$_SERVER;$this->assertTrue(class_exists(EventManager::class),'Front pipeline not implemented.');$_SERVER['HTTP_USER_AGENT']='Mozilla/5.0';$_SERVER['REQUEST_URI']='/';wp_set_current_user(0);wp_dequeue_script('pixelpair-tracker');wp_deregister_script('pixelpair-tracker');}
	protected function tearDown(): void {$_SERVER=$this->server;remove_all_filters('pixelpair_platforms');remove_all_filters('pixelpair_bot_user_agents');remove_all_filters('pixelpair_consent_marketing');parent::tearDown();}
	private function enable(array $settings=array()): void {(new Repository())->update(array_merge(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345'),$settings));}
	public function test_wordpress_62_combined_inline_and_external_tags_defer_only_the_external_script(): void {
		$inline='<script id="pixelpair-tracker-js-before">window.pixelpairConfig={};</script>';
		$external='<script src="tracker.js" id="pixelpair-tracker-js"></script>';
		$this->assertSame($inline.'<script defer src="tracker.js" id="pixelpair-tracker-js"></script>',EventManager::defer_tag($inline.$external,'pixelpair-tracker'));
		$this->assertSame($inline.$external,EventManager::defer_tag($inline.$external,'unrelated'));
		$deferred='<script src="tracker.js" defer></script>';
		$this->assertSame($inline.$deferred,EventManager::defer_tag($inline.$deferred,'pixelpair-tracker'));
	}
	public function test_disabled_pixel_has_no_front_assets_and_mode_selection_is_exact(): void {
		$this->assertNull((new EventManager())->configuration());
		$this->enable();$config=(new EventManager())->configuration();$this->assertFalse($config['gate']['required']);
		$this->enable(array('excluded_ips'=>array('192.0.2.1')));$this->assertTrue((new EventManager())->configuration()['gate']['required']);
		$this->enable(array('excluded_ips'=>array(),'strict_cache_mode'=>true));$this->assertTrue((new EventManager())->configuration()['gate']['required']);
	}
	public function test_fast_excludes_current_role_and_strict_keeps_shared_configuration(): void {
		$this->enable(array('excluded_roles'=>array('subscriber')));$guest=(new EventManager())->configuration();
		wp_set_current_user(get_users(array('role'=>'subscriber','number'=>1))[0]->ID);$this->assertNull((new EventManager())->configuration());
		$this->enable(array('strict_cache_mode'=>true));$subscriber=(new EventManager())->configuration();wp_set_current_user(0);$this->assertSame($subscriber,(new EventManager())->configuration());
		$this->assertArrayNotHasKey('event_id',$guest);$this->assertArrayNotHasKey('user_data',$guest);
	}
	public function test_json_is_inert_safe_and_query_free_after_options_are_loaded(): void {
		$this->enable();add_filter('pixelpair_bot_user_agents',static function(){return array('</script><script>alert(1)</script>');});
		$manager=new EventManager();$manager->configuration();global $wpdb;$before=$wpdb->num_queries;
		$manager->render_config();$html=implode('',wp_scripts()->get_data('pixelpair-tracker','before'));$this->assertSame($before,$wpdb->num_queries);
		$this->assertStringNotContainsString('</script><script>alert',$html);$this->assertStringContainsString('\\u003C',$html);
		foreach(array('event_id','nonce','user_data','email','excluded_roles','excluded_ips') as $private){$this->assertStringNotContainsString($private,$html);}
		$this->assertTrue(wp_script_is('pixelpair-tracker','enqueued'));
		$this->assertSame('<script defer src="test"></script>',EventManager::defer_tag('<script src="test"></script>','pixelpair-tracker'));
		$this->assertSame('<script src="test"></script>',EventManager::defer_tag('<script src="test"></script>','unrelated'));
	}
	public function test_preloader_keeps_inert_config_and_platform_filter_can_disable_meta(): void {
		$this->enable();$_SERVER['HTTP_USER_AGENT']='WP Rocket/Preload';$this->assertNotNull((new EventManager())->configuration());
		$_SERVER['HTTP_USER_AGENT']='Googlebot';$this->assertNull((new EventManager())->configuration());
		$_SERVER['HTTP_USER_AGENT']='Mozilla';add_filter('pixelpair_platforms',static function(){return array();});$this->assertNull((new EventManager())->configuration());
	}
}
