<?php
/** @package PixelPair */
use PixelPair\Events\Event;
use PixelPair\Platforms\Meta\Payload;
use PixelPair\Platforms\Meta\Client;
use PixelPair\Settings\Repository;
use PixelPair\Settings\Secrets;

final class CapiTest extends LifecycleTestCase {
	public function test_public_event_raw_identity_is_hashed_by_the_meta_adapter(): void {
		$event=new Event('page_view',wp_generate_uuid4(),time(),home_url(),array(),array('em'=>' Test@Example.COM ','ph'=>'+1 (202) 555-0123','secret'=>'never-send'));
		$data=Payload::build($event)['user_data'];$this->assertSame(array(hash('sha256','test@example.com')),$data['em']);$this->assertSame(array(hash('sha256','12025550123')),$data['ph']);$this->assertArrayNotHasKey('secret',$data);
	}
	public function test_golden_pageview_envelope(): void {
		$event=new Event('page_view','12345678-1234-4234-8234-123456789012',1700000000,'https://example.com/public',array(),array('client_user_agent'=>'Fixture Browser'));
		$this->assertEquals(json_decode(file_get_contents(__DIR__.'/fixtures/capi-pageview.json')),json_decode(wp_json_encode(Payload::build($event))));
	}
	protected function tearDown(): void { delete_option('pixelpair_secrets'); parent::tearDown(); }
	public function test_pageview_payload_shares_browser_id_and_hashes_without_token(): void {
		$this->assertTrue(class_exists(Payload::class), 'CAPI payload builder missing.');
		$event = new Event('page_view','12345678-1234-4234-8234-123456789012',1700000000,home_url('/public'),array(),array('em'=>array(str_repeat('a',64)),'client_user_agent'=>'Test'));
		$payload = Payload::build($event);
		$this->assertSame('PageView',$payload['event_name']);
		$this->assertSame($event->event_id,$payload['event_id']);
		$this->assertSame(1700000000,$payload['event_time']);
		$this->assertSame('website',$payload['action_source']);
		$this->assertSame(array(str_repeat('a',64)),$payload['user_data']['em']);
		$this->assertArrayNotHasKey('access_token',$payload);
	}
	public function test_ldu_and_sensitive_mode_remove_context_urls(): void {
		$this->assertTrue(class_exists(Payload::class), 'CAPI payload builder missing.');
		(new Repository())->update(array('meta_ldu'=>true,'meta_sensitive_data'=>true));
		$event = new Event('page_view',wp_generate_uuid4(),time(),home_url('/sensitive?x=private'),array('page_title'=>'private','categories'=>array('private'),'value'=>2),array());
		$payload = Payload::build($event);
		$this->assertSame(array('LDU'),$payload['data_processing_options']);
		$this->assertSame(trailingslashit(home_url()),$payload['event_source_url']);
		$this->assertStringNotContainsString('private',wp_json_encode($payload));
	}
	public function test_http_failure_is_redacted_and_retries_are_classified(): void {
		$this->assertTrue(class_exists(Client::class), 'CAPI client missing.');
		(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>true));
		(new Secrets())->update(array('token'=>'EAAtest_secret_12345','test_code'=>'TEST123'));
		$seen = array();
		$stub = static function($pre,$args,$url) use (&$seen) { $seen=compact('args','url'); return array('response'=>array('code'=>503),'body'=>'{"error":{"code":2,"message":"EAAtest_secret_12345 user@example.com"}}','headers'=>array()); };
		add_filter('pre_http_request',$stub,10,3);
		try { $result=(new Client())->send(array('event_name'=>'PageView','event_id'=>'opaque')); }
		finally { remove_filter('pre_http_request',$stub); }
		$this->assertStringStartsWith('https://graph.facebook.com/v26.0/123456789012345/events',$seen['url']);
		$this->assertStringNotContainsString('EAAtest',$seen['url']);
		$body=json_decode($seen['args']['body'],true);
		$this->assertSame('TEST123',$body['test_event_code']);
		$this->assertSame('opaque',$body['data'][0]['event_id']);
		$this->assertTrue($result['retry']);
		$this->assertFalse($result['success']);
		$this->assertStringNotContainsString('EAAtest',wp_json_encode($result));
		$this->assertStringNotContainsString('user@example',wp_json_encode($result));
	}
}
