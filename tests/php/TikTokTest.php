<?php
/** @package PixelPair */
use PixelPair\Settings\{Repository, Secrets, Migrations};
use PixelPair\Events\{Event, Queue};
use PixelPair\Platforms\TikTok\{Payload, Client};

final class TikTokTest extends LifecycleTestCase {
 protected function tearDown(): void { delete_option('pixelpair_tiktok_secrets'); delete_option('pixelpair_secrets'); parent::tearDown(); }
 public function test_platform_settings_secrets_and_legacy_rules_are_isolated(): void {
  $s=(new Repository())->update(array('tiktok_enabled'=>true,'tiktok_pixel_id'=>'C1234567890ABCDEFGHI','tiktok_capi_enabled'=>true));
  $this->assertIsArray($s);
  $this->assertInstanceOf(WP_Error::class,(new Repository())->update(array('tiktok_pixel_id'=>'bad<script>')));
  (new Secrets())->update(array('token'=>'METAsecret12345'));
  (new Secrets('tiktok'))->update(array('token'=>'TIKTOKsecret12345'));
  $this->assertSame('METAsecret12345',(new Secrets())->token());
  $this->assertSame('TIKTOKsecret12345',(new Secrets('tiktok'))->token());
  $this->assertStringNotContainsString('TIKTOKsecret',wp_json_encode((new Secrets('tiktok'))->status()));
  foreach($s['automatic_events'] as &$rule) { unset($rule['platforms']['tiktok']); } unset($rule);
  $s['automatic_events']['search']['platforms']['meta']['name']='MySearch';
  update_option('pixelpair_settings',$s); update_option('pixelpair_db_version','5'); Migrations::run();
  $after=(new Repository())->get();
  $this->assertSame('MySearch',$after['automatic_events']['search']['platforms']['meta']['name']);
  $this->assertSame('PageView',$after['automatic_events']['page_view']['platforms']['tiktok']['name']);
 }
 public function test_payload_has_vendor_fields_shared_id_and_only_allowed_matching(): void {
  $this->assertTrue(class_exists(Payload::class));
  $e=new Event('page_view',wp_generate_uuid4(),time(),home_url('/public'),array('value'=>12,'currency'=>'USD'),array('em'=>' Test@Example.COM ','ph'=>'+12025550123','ttp'=>'cookie','ttclid'=>'click','secret'=>'never'));
  $p=Payload::build($e);
  $this->assertSame($e->event_id,$p['event_id']); $this->assertSame('PageView',$p['event']);
  $this->assertSame(hash('sha256','test@example.com'),$p['user']['email']);
  $this->assertSame('cookie',$p['user']['ttp']); $this->assertArrayNotHasKey('secret',$p['user']);
  $this->assertSame(12,((array)$p['properties'])['value']);
 }
 public function test_queue_separates_platforms_and_cancels_changed_destination(): void {
  $s=(new Repository())->update(array('tiktok_enabled'=>true,'tiktok_pixel_id'=>'C1234567890ABCDEFGHI','tiktok_capi_enabled'=>true,'meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>true)); $this->assertIsArray($s);
  (new Secrets('tiktok'))->update(array('token'=>'TIKTOKsecret12345'));
  $e=new Event('page_view',wp_generate_uuid4(),time(),home_url()); $q=new Queue();
  $a=$q->enqueue($e); $b=$q->enqueue($e,'tiktok'); $this->assertIsInt($b); $this->assertNotSame($a,$b); $this->assertSame($b,$q->enqueue($e,'tiktok'));
  (new Repository())->update(array('tiktok_pixel_id'=>'C9999999999ABCDEFGHI'));
  $calls=0; $stub=static function()use(&$calls){++$calls;return new WP_Error('unexpected');}; add_filter('pre_http_request',$stub);
  try{$q->run($b);}finally{remove_filter('pre_http_request',$stub);}
  global $wpdb; $this->assertSame('cancelled',$wpdb->get_var($wpdb->prepare("SELECT status FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d",$b))); $this->assertSame(0,$calls);
 }
 public function test_http_success_requires_vendor_code_and_never_logs_token(): void {
  $this->assertTrue(class_exists(Client::class));
  (new Repository())->update(array('tiktok_enabled'=>true,'tiktok_pixel_id'=>'C1234567890ABCDEFGHI','tiktok_capi_enabled'=>true)); (new Secrets('tiktok'))->update(array('token'=>'TIKTOKsecret12345','test_code'=>'TEST123'));
  $seen=array(); $stub=static function($pre,$args,$url)use(&$seen){$seen=compact('args','url');return array('response'=>array('code'=>429),'body'=>'{"code":40002,"message":"TIKTOKsecret12345"}','headers'=>array());}; add_filter('pre_http_request',$stub,10,3);
  try{$r=(new Client())->send(array('event'=>'PageView','event_id'=>'same'));}finally{remove_filter('pre_http_request',$stub);}
  $this->assertSame('https://business-api.tiktok.com/open_api/v1.3/event/track/',$seen['url']);
  $this->assertSame('TIKTOKsecret12345',$seen['args']['headers']['Access-Token']);
  $body=json_decode($seen['args']['body'],true); $this->assertSame('web',$body['event_source']); $this->assertSame('same',$body['data'][0]['event_id']);
  $this->assertTrue($r['retry']); $this->assertFalse($r['success']); $this->assertStringNotContainsString('TIKTOKsecret',wp_json_encode($r));
 }
}

