<?php
/** @package PixelPair */
use PixelPair\Events\{Queue,Tables,Event};
use PixelPair\Settings\{Repository,Secrets};

final class QueueTest extends LifecycleTestCase {
	public function test_expired_final_attempt_cannot_remain_in_processing_forever(): void {
		$queue=new Queue();$id=$queue->enqueue(new Event('page_view',wp_generate_uuid4(),time(),home_url('/'),array(),array()));
		global $wpdb;$wpdb->update($wpdb->prefix.'pixelpair_jobs',array('status'=>'processing','attempts'=>4,'lease_until'=>time()-1,'next_at'=>time()-1),array('id'=>$id));
		$queue->sweep();
		$row=$wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d",$id),ARRAY_A);
		$this->assertSame('failed',$row['status']);$this->assertSame('',$row['payload']);
	}
	protected function setUp(): void {
		parent::setUp(); $this->assertTrue(class_exists(Queue::class),'Delivery queue missing.'); Tables::install(); Tables::clear();
		(new Repository())->update(array('meta_enabled'=>true,'meta_capi_enabled'=>true,'meta_pixel_id'=>'123456789012345','logging_enabled'=>true));
		(new Secrets())->update(array('token'=>'EAAtest_secret_12345'));
	}
	protected function tearDown(): void { if(class_exists(Tables::class)){Tables::clear();} wp_unschedule_hook('pixelpair_deliver'); delete_option('pixelpair_secrets'); parent::tearDown(); }
	public function test_retry_limit_preserves_event_id_then_clears_payload_and_redacts_logs(): void {
		$sent=array();
		$stub=static function($pre,$args,$url) use (&$sent) { if(strpos($url,'graph.facebook.com')===false){return $pre;} $sent[]=json_decode($args['body'],true)['data'][0]; return array('response'=>array('code'=>503),'headers'=>array(),'body'=>'{"error":{"code":2,"message":"private"}}'); };
		add_filter('pre_http_request',$stub,10,3);
		$queue=new Queue(); $event=new Event('page_view',wp_generate_uuid4(),time(),home_url('/private'),array(),array('client_ip_address'=>'192.0.2.2'));
		$id=$queue->enqueue($event); $this->assertIsInt($id);
		global $wpdb;
		try {
			for($i=0;$i<5;$i++){ $wpdb->update($wpdb->prefix.'pixelpair_jobs',array('next_at'=>time()-1),array('id'=>$id)); $queue->run($id); }
		} finally { remove_filter('pre_http_request',$stub); }
		$this->assertCount(4,$sent,'Initial request plus at most three retries.');
		foreach($sent as $payload){$this->assertSame($event->event_id,$payload['event_id']);}
		$row=$wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d",$id),ARRAY_A);
		$this->assertSame('failed',$row['status']); $this->assertSame('',$row['payload']);
		$logs=wp_json_encode($wpdb->get_results("SELECT * FROM {$wpdb->prefix}pixelpair_logs",ARRAY_A));
		$this->assertStringNotContainsString('private',$logs); $this->assertStringNotContainsString('192.0.2.2',$logs); $this->assertStringNotContainsString('EAAtest',$logs);
	}
	public function test_disabled_capi_cancels_queued_delivery(): void {
		$queue=new Queue(); $id=$queue->enqueue(new Event('page_view',wp_generate_uuid4(),time(),home_url('/'),array(),array()));
		(new Repository())->update(array('meta_capi_enabled'=>false)); $queue->run($id);
		global $wpdb; $row=$wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d",$id),ARRAY_A);
		$this->assertSame('cancelled',$row['status']); $this->assertSame('',$row['payload']);
	}
}
