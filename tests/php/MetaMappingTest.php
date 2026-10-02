<?php
/** @package PixelPair */
use PixelPair\Events\Event;
use PixelPair\Platforms\Meta\MetaPlatform;
use PixelPair\Settings\Repository;

final class MetaMappingTest extends LifecycleTestCase {
	public function test_pageview_mapping_and_disabled_platform_contract(): void {
		$this->assertTrue(class_exists(MetaPlatform::class),'Meta adapter not implemented.');
		$platform=new MetaPlatform();$this->assertSame('meta',$platform->id());$this->assertFalse($platform->is_enabled());$this->assertFalse($platform->supports_server_side());
		$event=new Event('page_view','550e8400-e29b-41d4-a716-446655440000',time(),home_url('/'),array(),array('email'=>'private@example.test'));
		$this->assertSame(array('name'=>'PageView','params'=>array()),$platform->map_event($event));
		$this->assertNull($platform->map_event(new Event('purchase','',time(),home_url('/'))));
		$called=false;$hook=static function()use(&$called){$called=true;return new WP_Error('no_http');};add_filter('pre_http_request',$hook);
		try{$platform->send_server_event($event);$this->assertFalse($called);}finally{remove_filter('pre_http_request',$hook);}
		ob_start();$platform->render_base_code();$this->assertSame('',ob_get_clean());
		(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
		$this->assertTrue($platform->is_enabled());
		ob_start();$platform->render_base_code();$json=ob_get_clean();$this->assertSame(array('enabled'=>true,'pixel_id'=>'123456789012345'),json_decode($json,true));
		$this->assertStringNotContainsString('private@',$json);
	}
}
