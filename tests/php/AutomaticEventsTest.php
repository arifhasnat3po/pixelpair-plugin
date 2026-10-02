<?php
/** @package PixelPair */
use PixelPair\Events\Automatic\Registry;
use PixelPair\Events\Automatic\Flags;
use PixelPair\Settings\Repository;
use PixelPair\Events\Event;
final class AutomaticEventsTest extends LifecycleTestCase {
 public function test_registry_has_each_separate_event_and_safe_defaults(): void {
  $this->assertTrue(class_exists(Registry::class));$defs=Registry::defaults();$this->assertCount(11,$defs);
  foreach(array('PageView','Search','FormSubmit','Signup','Login','Comment','FileDownload','ScrollDepth','TimeOnPage','NotFound','OutboundLink') as $class){$this->assertTrue(class_exists('PixelPair\\Events\\Automatic\\'.$class));}
  $this->assertFalse($defs['outbound_link']['enabled']);$this->assertTrue($defs['not_found']['platforms']['ga4']['enabled']);$this->assertFalse($defs['not_found']['platforms']['meta']['enabled']);
  $s=(new Repository())->get();$this->assertFalse($s['capture_form_fields']);$this->assertSame(array(25,50,75,90),$s['scroll_thresholds']);
 }
 public function test_mapping_and_toggles_apply_to_server_events(): void {
  $this->assertTrue(class_exists(Registry::class));$meta=new \PixelPair\Platforms\Meta\MetaPlatform();
  $mapped=$meta->map_event(new Event('search',wp_generate_uuid4(),time(),home_url(),array('search_string'=>'shoes')));$this->assertSame('Search',$mapped['name']);
  $defs=Registry::defaults();$defs['search']['platforms']['meta']['name']='ProductSearch';$defs['search']['platforms']['meta']['params']=array('origin'=>'site');
  $this->assertIsArray((new Repository())->update(array('automatic_events'=>$defs)));$this->assertSame('ProductSearch',$meta->map_event(new Event('search','id',time(),home_url()))['name']);
  $defs['search']['enabled']=false;(new Repository())->update(array('automatic_events'=>$defs));$this->assertNull($meta->map_event(new Event('search','id',time(),home_url())));
  $defs['page_view']['enabled']=false;$this->assertInstanceOf(WP_Error::class,(new Repository())->update(array('automatic_events'=>$defs)));
 }
 public function test_flags_are_short_lived_bound_to_actor_and_consumed_once(): void {
  $this->assertTrue(class_exists(Flags::class));$cookies=$_COOKIE;
  (new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
  try{Flags::mark('login',11);$this->assertSame(array(),Flags::consume(12));$this->assertSame(array('login'),Flags::consume(11));$this->assertSame(array(),Flags::consume(11));
   Flags::mark('sign_up',0);Flags::mark('comment',0);$this->assertSame(array('sign_up','comment'),Flags::consume(0));
  }finally{$_COOKIE=$cookies;}
 }
 public function test_denied_consent_creates_no_action_cookie(): void {
  $cookies=$_COOKIE;unset($_COOKIE['pixelpair_pending'],$_COOKIE['pixelpair_has_pending']);(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','deny_until_consent'=>true));
  try{Flags::mark('login',1);$this->assertArrayNotHasKey('pixelpair_pending',$_COOKIE);}finally{$_COOKIE=$cookies;}
 }
 public function test_thresholds_context_options_and_payloads_reject_malformed_input(): void {
  $this->assertInstanceOf(WP_Error::class,(new Repository())->update(array('context_parameters'=>array(array('bad')))));
  foreach(array(array('scroll_thresholds'=>array(0,101)),array('time_thresholds'=>array('30')),array('download_extensions'=>array('pdf<script>')),array('context_parameters'=>array('email')),array('capture_form_fields'=>'true')) as $change){$this->assertInstanceOf(WP_Error::class,(new Repository())->update($change));}
 }
}
