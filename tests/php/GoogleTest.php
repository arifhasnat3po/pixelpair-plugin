<?php
/** @package PixelPair */
use PixelPair\Settings\Repository;
use PixelPair\Events\EventManager;
use PixelPair\Events\BootstrapController;
use PixelPair\Platforms\GTM\ContainerExport;

final class GoogleTest extends LifecycleTestCase {
 public function test_gtm_adapter_uses_current_event_mapping(): void {
  $settings=(new Repository())->get();$events=$settings['automatic_events'];
  $events['search']['platforms']['gtm']['name']='site_search';
  (new Repository())->update(array('automatic_events'=>$events));
  $event=new \PixelPair\Events\Event('search','123e4567-e89b-42d3-a456-426614174000',time(),home_url('/'),array('search_string'=>'sample'));
  $mapped=(new \PixelPair\Platforms\GTM\GTMPlatform())->map_event($event);
  $this->assertSame('pixelpair_site_search',$mapped['event']);
  $events['search']['platforms']['gtm']['enabled']=false;
  (new Repository())->update(array('automatic_events'=>$events));
  $this->assertNull((new \PixelPair\Platforms\GTM\GTMPlatform())->map_event($event));
 }
 private $server;
 protected function setUp(): void {parent::setUp();$this->server=$_SERVER;}
 protected function tearDown(): void {$_SERVER=$this->server;parent::tearDown();}
 public function test_google_only_settings_and_public_configuration(): void {
  $r=(new Repository())->update(array('ga4_enabled'=>true,'ga4_ids'=>array('G-ABC123','G-XYZ789'),'google_data_layer'=>'customLayer','ga4_server_url'=>'https://metrics.example.test/path','ga4_debug'=>true));
  $this->assertIsArray($r);
  $c=(new EventManager())->configuration();
  $this->assertSame(array('G-ABC123','G-XYZ789'),$c['ga4']['ids']);
  $this->assertSame('customLayer',$c['ga4']['layer']);
  $this->assertFalse($c['gate']['required']);
 }
 public function test_invalid_google_settings_reject_atomically(): void {
  $this->assertInstanceOf(WP_Error::class,(new Repository())->update(array('ga4_ids'=>array(array('bad')))));
  foreach(array(array('ga4_ids'=>array('G-X<script>')),array('ga4_enabled'=>true),array('google_data_layer'=>'location'),array('google_data_layer'=>'a.b'),array('gtm_enabled'=>true,'gtm_id'=>'G-ABC'),array('ga4_server_url'=>'http://metrics.test'),array('gtm_server_url'=>'https://user:pass@metrics.test'),array('gtm_server_url'=>'https://metrics.test/?x=1')) as $input){
   $before=(new Repository())->get();$this->assertInstanceOf(WP_Error::class,(new Repository())->update($input));$this->assertSame($before,(new Repository())->get());
  }
 }
 public function test_statistics_gate_is_independent_and_honors_filter(): void {
  (new Repository())->update(array('ga4_enabled'=>true,'ga4_ids'=>array('G-ABC123')));
  $filter=static function(){return false;};add_filter('pixelpair_consent_marketing',$filter);
  $_SERVER['REMOTE_ADDR']='203.0.113.91';$_SERVER['HTTP_USER_AGENT']='Mozilla/5.0';
  $body=wp_json_encode(array('url'=>home_url('/'),'category'=>'statistics','consent'=>array('source'=>'integration','granted'=>true)));
  try{$r=(new BootstrapController())->evaluate($body,home_url(),'POST');$this->assertIsArray($r);$this->assertTrue($r['allowed']);$this->assertTrue($r['ga4']['enabled']);}finally{remove_filter('pixelpair_consent_marketing',$filter);}
  add_filter('pixelpair_consent_statistics',$filter);
  try{$this->assertFalse((new BootstrapController())->evaluate($body,home_url(),'POST')['allowed']);}finally{remove_filter('pixelpair_consent_statistics',$filter);}
 }
 public function test_consent_api_registration_and_container_export_references(): void {
  $this->assertTrue(apply_filters('wp_consent_api_registered_'.plugin_basename(PIXELPAIR_FILE),false));
  $this->assertTrue(class_exists(ContainerExport::class));$data=ContainerExport::build();$this->assertSame(2,$data['exportFormatVersion']);
  $c=$data['containerVersion'];$ids=array_column($c['trigger'],'triggerId');$this->assertNotEmpty($c['variable']);
  foreach($c['tag'] as $tag){$this->assertSame('gaawe',$tag['type']);foreach($tag['firingTriggerId'] as $id){$this->assertContains($id,$ids);}}
  $this->assertStringContainsString('G-REPLACE_ME',wp_json_encode($data));
 }
}
