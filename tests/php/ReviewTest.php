<?php
/** @package PixelPair */
use PixelPair\Events\CollectorController;
use PixelPair\Events\Automatic\Flags;
use PixelPair\Settings\Repository;
final class ReviewTest extends LifecycleTestCase {
 private $server; private $post; private $cookies;
 protected function setUp(): void {parent::setUp();$this->server=$_SERVER;$this->post=$_POST;$this->cookies=$_COOKIE;$_COOKIE=array();$_POST=array();$_SERVER['REQUEST_METHOD']='POST';$_SERVER['HTTP_ORIGIN']=home_url();$_SERVER['REMOTE_ADDR']='198.51.100.78';$_SERVER['HTTP_USER_AGENT']='Mozilla/5.0';(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>true));\PixelPair\Support\RateLimiter::clear($_SERVER['REMOTE_ADDR'],'event');}
 protected function tearDown(): void {$_SERVER=$this->server;$_POST=$this->post;$_COOKIE=$this->cookies;\PixelPair\Events\Tables::clear();parent::tearDown();}
 private function collect(array $extra=array()) {return (new CollectorController())->evaluate(wp_json_encode(array_replace(array('event_name'=>'page_view','expected_name'=>'PageView','event_id'=>wp_generate_uuid4(),'source_url'=>home_url('/'),'params'=>(object)array(),'consent'=>array('source'=>'default','granted'=>true)),$extra)),home_url(),'POST');}
 public function test_stale_meta_name_is_rejected_without_remapping_the_browser_event(): void {
  $s=(new Repository())->get()['automatic_events'];$s['page_view']['platforms']['meta']['name']='NewPage';(new Repository())->update(array('automatic_events'=>$s));
  $stale=$this->collect();$this->assertInstanceOf(WP_Error::class,$stale);$this->assertSame(409,$stale->get_error_data()['status']);
  $this->assertSame(array('accepted'=>true),$this->collect(array('expected_name'=>'NewPage')));
 }
 public function test_all_saved_parameters_plus_context_are_accepted_and_expansion_is_bounded(): void {
  $p=array();for($i=0;$i<25;$i++){$p['custom_'.$i]='value';}
  $s=(new Repository())->get()['automatic_events'];$s['page_view']['platforms']['meta']['params']=$p;
  $this->assertIsArray((new Repository())->update(array('automatic_events'=>$s)));
  foreach(\PixelPair\Settings\Defaults::all()['context_parameters'] as $key){$p[$key]='context';}
  $this->assertSame(array('accepted'=>true),$this->collect(array('params'=>(object)$p)));
  $s['page_view']['platforms']['meta']['params']=array('long_value'=>'{page_url}{page_url}');(new Repository())->update(array('automatic_events'=>$s));
  $event=new \PixelPair\Events\Event('page_view',wp_generate_uuid4(),time(),home_url('/?x='.str_repeat('a',1500)));
  $mapped=\PixelPair\Events\Mapping::event($event,'meta');$this->assertLessThanOrEqual(512,mb_strlen($mapped['params']['long_value']));
 }
 public function test_direct_cmp_submission_can_authorize_confirmed_action_but_not_denial_or_cross_origin(): void {
  $filter=static function(){return array('cookiebot');};add_filter('pixelpair_consent_tools',$filter);
  try {
   $_POST['pixelpair_action_consent']=wp_json_encode(array('marketing'=>array('granted'=>true,'source'=>'cookiebot'),'statistics'=>array('granted'=>false,'source'=>'cookiebot')));
   Flags::mark('login',42);$this->assertSame(array('login'),Flags::consume(42));
   $_SERVER['HTTP_ORIGIN']='https://attacker.test';Flags::mark('login',42);$this->assertSame(array(),Flags::consume(42));
   $_SERVER['HTTP_ORIGIN']=home_url();$_POST['pixelpair_action_consent']=wp_json_encode(array('marketing'=>array('granted'=>false,'source'=>'cookiebot'),'statistics'=>array('granted'=>false,'source'=>'cookiebot')));Flags::mark('login',42);$this->assertSame(array(),Flags::consume(42));
  } finally {remove_filter('pixelpair_consent_tools',$filter);}
 }
}
