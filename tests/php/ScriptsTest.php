<?php
/** @package PixelPair */
use PixelPair\Scripts\{Repository,Renderer,Controller};
final class ScriptsTest extends LifecycleTestCase {
 private $actor=0;
 protected function tearDown(): void{delete_option('pixelpair_scripts');if($this->actor){require_once ABSPATH.'wp-admin/includes/user.php';wp_delete_user($this->actor);}parent::tearDown();}
 private function admin(): void{$this->actor=wp_create_user('script-test-'.wp_generate_password(8,false),'password','script-'.wp_generate_password(8,false).'@example.test');$u=new WP_User($this->actor);$u->set_role('administrator');$u->add_cap('manage_pixelpair');wp_set_current_user($this->actor);}
 public function test_raw_scripts_require_both_capabilities_and_valid_nonce(): void {
  $this->assertTrue(class_exists(Repository::class));$v=Repository::defaults();$v['head']['code']='<script>window.example=1;</script>';
  $this->assertInstanceOf(WP_Error::class,(new Repository())->save($v));$this->admin();
  $req=new WP_REST_Request('POST','/pixelpair/v1/scripts');$this->assertInstanceOf(WP_Error::class,(new Controller())->permissions($req));$req->set_header('X-WP-Nonce',wp_create_nonce('wp_rest'));$this->assertTrue((new Controller())->permissions($req));
  $this->assertSame($v,(new Repository())->save($v));$u=wp_get_current_user();$u->add_cap('unfiltered_html',false);$this->assertInstanceOf(WP_Error::class,(new Repository())->save(Repository::defaults()));$this->assertSame($v,(new Repository())->get());
 }
 public function test_post_modes_and_placeholder_literals_are_safe(): void {
  $this->assertTrue(class_exists(Renderer::class));$this->admin();$v=Repository::defaults();$v['head']['code']='global';(new Repository())->save($v);
  $post=wp_insert_post(array('post_type'=>'page','post_status'=>'publish','post_title'=>'Script test'));
  try{$local=Repository::defaults();$local['head']['code']='local';$r=new Repository();$this->assertIsArray($r->save_post($post,array('mode'=>'append','scripts'=>$local)));$this->assertCount(2,Renderer::rows($post,'head'));
   $r->save_post($post,array('mode'=>'disable','scripts'=>$local));$this->assertSame(array(),Renderer::rows($post,'head'));
   $r->save_post($post,array('mode'=>'replace','scripts'=>$local));$this->assertSame('local',Renderer::rows($post,'head')[0]['code']);
   $safe=Renderer::substitute('const id={order_id},total={order_total},currency={currency};',array('order_id'=>42,'order_total'=>12.5,'currency'=>'USD</script><script>alert(1)</script>'));
   $this->assertStringNotContainsString('</script>',$safe);$this->assertStringContainsString('id=42,total=12.5',$safe);
  }finally{wp_delete_post($post,true);}
 }
 public function test_schema_rejects_unknown_slots_devices_categories_and_oversized_code(): void {
  $this->assertTrue(class_exists(Repository::class));$this->admin();$v=Repository::defaults();$v['head']['device']='bot';$this->assertInstanceOf(WP_Error::class,(new Repository())->save($v));
  $v=Repository::defaults();$v['head']['consent']='bypass';$this->assertInstanceOf(WP_Error::class,(new Repository())->save($v));$this->assertSame(Repository::defaults(),(new Repository())->get());
 }
}
