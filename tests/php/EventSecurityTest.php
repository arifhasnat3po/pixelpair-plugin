<?php
/** @package PixelPair */
use PixelPair\Settings\Repository;
use PixelPair\Events\Automatic\Registry;
use PixelPair\Events\Custom\Repository as Rules;
use PixelPair\Events\CollectorController;
use PixelPair\Events\Queue;
use PixelPair\Support\Crypto;
final class EventSecurityTest extends LifecycleTestCase {
 private $server;private $cookies;
 protected function setUp(): void {parent::setUp();$this->server=$_SERVER;$this->cookies=$_COOKIE;$_COOKIE=array();$_SERVER['REQUEST_METHOD']='POST';$_SERVER['REMOTE_ADDR']='198.51.100.70';$_SERVER['HTTP_USER_AGENT']='Mozilla/5.0';$_SERVER['HTTP_ORIGIN']=home_url();\PixelPair\Settings\Migrations::run();\PixelPair\Events\Tables::clear();\PixelPair\Support\RateLimiter::clear($_SERVER['REMOTE_ADDR'],'event');(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>true));}
 protected function tearDown(): void {$_SERVER=$this->server;$_COOKIE=$this->cookies;\PixelPair\Events\Tables::clear();parent::tearDown();}
 private function collect(string $name,array $extra=array()){return (new CollectorController())->evaluate(wp_json_encode(array_replace(array('event_name'=>$name,'expected_name'=>(\PixelPair\Events\Mapping::get($name,'meta')['name']??'Unknown'),'event_id'=>wp_generate_uuid4(),'source_url'=>home_url('/?coupon=SAVE'),'params'=>(object)array(),'consent'=>array('source'=>'default','granted'=>true)),$extra)),home_url(),'POST');}
 public function test_rule_role_pause_and_server_toggle_are_authoritative(): void {
  $repo=new Rules();$rule=$repo->save(array('name'=>'Members','status'=>'active','triggers'=>array(array('type'=>'home')),'conditions'=>array(array('type'=>'role','value'=>'subscriber')),'platforms'=>Registry::defaults()['form_submit']['platforms'],'once_per_session'=>false));$id=$rule['id'];$name='custom_'.$id;
  try{$this->assertInstanceOf(WP_Error::class,$this->collect($name));$user=get_users(array('role'=>'subscriber','number'=>1))[0];$_COOKIE[LOGGED_IN_COOKIE]=wp_generate_auth_cookie($user->ID,time()+600,'logged_in');$this->assertSame(array('accepted'=>true),$this->collect($name));
   $old=$repo->rules();$rule['status']='paused';$repo->save($rule,$id);update_option('pixelpair_rules',$old,true);$this->assertInstanceOf(WP_Error::class,$this->collect($name),'A stale compiled snapshot cannot authorize a paused server rule.');
   global $wpdb;$job=(int)$wpdb->get_var("SELECT id FROM {$wpdb->prefix}pixelpair_jobs ORDER BY id DESC LIMIT 1");(new Queue())->run($job);$this->assertSame('cancelled',$wpdb->get_var($wpdb->prepare("SELECT status FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d",$job)));
  }finally{$repo->delete($id);}
 }
 public function test_form_matching_is_opt_in_hashed_and_never_an_arbitrary_identity_object(): void {
  $hash=hash('sha256','test@example.com');$this->assertInstanceOf(WP_Error::class,$this->collect('form_submit',array('matching'=>(object)array('em'=>$hash))));$this->assertSame(array(),$_COOKIE);
  (new Repository())->update(array('capture_form_fields'=>true,'meta_advanced_matching'=>true));$this->assertInstanceOf(WP_Error::class,$this->collect('form_submit',array('matching'=>(object)array('em'=>'test@example.com'))));
  $this->assertIsArray($this->collect('form_submit',array('matching'=>(object)array('em'=>$hash))));global $wpdb;$encrypted=$wpdb->get_var("SELECT payload FROM {$wpdb->prefix}pixelpair_jobs ORDER BY id DESC LIMIT 1");$payload=json_decode(Crypto::decrypt($encrypted),true);$this->assertSame(array($hash),$payload['event']['user_data']['em']);$this->assertStringNotContainsString('test@example.com',wp_json_encode($payload));
 }
 public function test_context_cookie_authentication_returns_roles_and_flags_once_without_identity(): void {
  $user=get_users(array('role'=>'subscriber','number'=>1))[0];$_COOKIE[LOGGED_IN_COOKIE]=wp_generate_auth_cookie($user->ID,time()+600,'logged_in');\PixelPair\Events\Automatic\Flags::mark('login',(int)$user->ID);wp_set_current_user(0);
  $request=new WP_REST_Request('POST','/pixelpair/v1/context');$request->set_body(wp_json_encode(array('url'=>home_url('/'),'consent'=>array('source'=>'default','granted'=>true))));$response=(new \PixelPair\Events\ContextController())->handle($request);$data=$response->get_data();$this->assertSame(array('subscriber'),$data['roles']);$this->assertSame(array('login'),$data['flags']);$this->assertArrayNotHasKey('user_id',$data);$this->assertSame(0,get_current_user_id());$this->assertSame(array(),(new \PixelPair\Events\ContextController())->handle($request)->get_data()['flags']);
 }
 public function test_disabled_context_fields_are_removed_even_from_submitted_params(): void {
  (new Repository())->update(array('context_parameters'=>array()));$event=new \PixelPair\Events\Event('page_view',wp_generate_uuid4(),time(),home_url(),array('page_title'=>'private','utm_source'=>'private'));$this->assertSame(array(),\PixelPair\Events\Mapping::event($event,'meta')['params']);
 }
}
