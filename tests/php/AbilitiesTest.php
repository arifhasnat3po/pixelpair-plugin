<?php
/** @package PixelPair */
final class AbilitiesTest extends LifecycleTestCase {
 private $actor;
 protected function setUp(): void {parent::setUp();\PixelPair\Settings\Migrations::run();$this->actor=wp_create_user('ai-test-'.wp_generate_password(8,false),'password');$u=new WP_User($this->actor);$u->set_role('administrator');$u->add_cap('manage_pixelpair');wp_set_current_user($this->actor);}
 protected function tearDown(): void {require_once ABSPATH.'wp-admin/includes/user.php';wp_delete_user($this->actor);parent::tearDown();}
 public function test_ai_rechecks_permission_site_and_forbidden_mutations(): void {
  $this->assertTrue(class_exists(\PixelPair\AI\Abilities::class));$ai=new \PixelPair\AI\Abilities();$input=array('site_id'=>get_current_blog_id());
  $this->assertArrayHasKey('checks',$ai->execute('audit',$input));$this->assertInstanceOf(WP_Error::class,$ai->execute('audit',array('site_id'=>get_current_blog_id()+1)));
  foreach(array('access_token'=>'secret','scripts'=>array(),'permissions'=>array('subscriber'),'ga4_server_url'=>'https://evil.example','gtm_server_url'=>'https://evil.example') as $key=>$value){$this->assertInstanceOf(WP_Error::class,$ai->execute('update-settings',array_merge($input,array('changes'=>array($key=>$value)))));}
  $this->assertIsArray($ai->execute('update-settings',array_merge($input,array('changes'=>array('strict_cache_mode'=>true)))));$this->assertTrue((new \PixelPair\Settings\Repository())->get()['strict_cache_mode']);
  wp_get_current_user()->add_cap('manage_pixelpair',false);$this->assertInstanceOf(WP_Error::class,$ai->execute('read-settings',$input));wp_set_current_user(0);$this->assertInstanceOf(WP_Error::class,$ai->execute('audit',$input));
 }
 public function test_ai_event_crud_and_bounded_redacted_reads(): void {
  $this->assertTrue(class_exists(\PixelPair\AI\Abilities::class));$ai=new \PixelPair\AI\Abilities();$input=array('site_id'=>get_current_blog_id());$rule=array('name'=>'AI test','status'=>'paused','triggers'=>array(array('type'=>'home')),'conditions'=>array(),'platforms'=>\PixelPair\Events\Automatic\Registry::defaults()['form_submit']['platforms'],'once_per_session'=>true);
  $created=$ai->execute('create-event',array_merge($input,array('event'=>$rule)));$this->assertIsArray($created);$id=$created['id'];$args=array_merge($input,array('id'=>$id));
  try{$this->assertSame('active',$ai->execute('toggle-event',array_merge($args,array('enabled'=>true)))['status']);$copy=$ai->execute('duplicate-event',$args);$this->assertSame('paused',$copy['status']);$this->assertTrue($ai->execute('delete-event',array_merge($input,array('id'=>$copy['id'],'confirm'=>true)))['deleted']);$rule['name']='Changed';$this->assertSame('Changed',$ai->execute('update-event',array_merge($args,array('event'=>$rule)))['name']);$this->assertInstanceOf(WP_Error::class,$ai->execute('delete-event',$args));$logs=$ai->execute('read-logs',$input);$this->assertLessThanOrEqual(50,count($logs['items']));}finally{(new \PixelPair\Events\Custom\Repository())->delete($id);}
 }
}
