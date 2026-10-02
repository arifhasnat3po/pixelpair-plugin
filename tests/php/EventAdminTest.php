<?php
/** @package PixelPair */
final class EventAdminTest extends LifecycleTestCase {
	public function test_nested_settings_round_trip_through_real_rest_json(): void {
		\PixelPair\Activation::activate(false);wp_set_current_user(get_users(array('role'=>'administrator','number'=>1))[0]->ID);$settings=(new \PixelPair\Settings\Repository())->get();$settings['meta_enabled']=true;$settings['meta_pixel_id']='123456789012345';$response=$this->request('POST','/settings',$settings);$this->assertSame(200,$response->get_status());$this->assertSame($settings['automatic_events'],$response->get_data()['automatic_events']);
	}
 private function request(string $method,string $path,array $body=array(),bool $nonce=true){$r=new WP_REST_Request($method,'/pixelpair/v1'.$path);$r->set_body(wp_json_encode($body));$r->set_header('Content-Type','application/json');if($nonce){$r->set_header('X-WP-Nonce',wp_create_nonce('wp_rest'));}return rest_get_server()->dispatch($r);}
 public function test_admin_crud_requires_nonce_and_capability_and_delete_confirmation(): void {
  \PixelPair\Activation::activate(false);$admin=get_users(array('role'=>'administrator','number'=>1))[0];wp_set_current_user($admin->ID);
  $this->assertSame(403,$this->request('GET','/events',array(),false)->get_status());
  $rule=array('name'=>'Admin rule','status'=>'active','triggers'=>array(array('type'=>'home')),'conditions'=>array(),'platforms'=>\PixelPair\Events\Automatic\Registry::defaults()['form_submit']['platforms'],'once_per_session'=>false);
  $response=$this->request('POST','/events',$rule);$this->assertSame(200,$response->get_status());$id=$response->get_data()['id'];
  try{$this->assertSame(400,$this->request('DELETE','/events/'.$id)->get_status());wp_set_current_user(0);$this->assertSame(403,$this->request('GET','/events')->get_status());}finally{wp_set_current_user($admin->ID);$this->assertSame(200,$this->request('DELETE','/events/'.$id,array('confirm'=>'yes'))->get_status());}
 }
 public function test_reactivation_restores_housekeeping_schedules(): void {
  \PixelPair\Activation::activate(false);\PixelPair\Deactivation::deactivate(false);$this->assertFalse(wp_next_scheduled('pixelpair_queue_sweep'));\PixelPair\Activation::activate(false);$this->assertNotFalse(wp_next_scheduled('pixelpair_queue_sweep'));$this->assertNotFalse(wp_next_scheduled('pixelpair_log_purge'));
 }
}
