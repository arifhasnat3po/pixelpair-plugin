<?php
/** @package PixelPair */
use PixelPair\Events\Custom\Validator;
use PixelPair\Events\Custom\Repository as Rules;
use PixelPair\Events\Automatic\Registry;
final class CustomEventsTest extends LifecycleTestCase {
 private function rule(): array {return array('name'=>'Coupon click','status'=>'active','triggers'=>array(array('type'=>'click','value'=>'.coupon')),'conditions'=>array(array('type'=>'device','value'=>'desktop')),'platforms'=>Registry::defaults()['form_submit']['platforms'],'once_per_session'=>true);}
 public function test_each_trigger_and_condition_can_be_validated(): void {
  $this->assertTrue(class_exists(Validator::class));
  foreach(array(array('type'=>'url','operator'=>'regex','value'=>'^https://example.test/thanks.*$','delay'=>2),array('type'=>'home'),array('type'=>'post_type','value'=>'post'),array('type'=>'posts','value'=>'1,2'),array('type'=>'terms','value'=>'category:12'),array('type'=>'click','value'=>'.buy'),array('type'=>'link','operator'=>'contains','value'=>'/download'),array('type'=>'mouseover','value'=>'#cta'),array('type'=>'scroll','value'=>50),array('type'=>'time','value'=>30),array('type'=>'page_count','value'=>3),array('type'=>'visible','value'=>'.offer'),array('type'=>'url_param','key'=>'coupon','operator'=>'equals','value'=>'SAVE')) as $trigger){$rule=$this->rule();$rule['triggers']=array($trigger);$this->assertIsArray(Validator::validate($rule));}
  foreach(array('device'=>'tablet','role'=>'logged-out','url_contains'=>'/offer','url_not_contains'=>'preview','utm_source'=>'newsletter','utm_medium'=>'email','utm_campaign'=>'autumn','referrer_domain'=>'example.com') as $type=>$value){$rule=$this->rule();$rule['conditions']=array(array('type'=>$type,'value'=>$value));$this->assertIsArray(Validator::validate($rule));}
 }
 public function test_hostile_regex_selectors_tokens_and_platform_destinations_are_rejected(): void {
  $this->assertTrue(class_exists(Validator::class));
  foreach(array(array('type'=>'url','operator'=>'regex','value'=>'(a+)+$'),array('type'=>'click','value'=>'<script>'),array('type'=>'click','value'=>'a['),array('type'=>'time','value'=>-1),array('type'=>'execute','value'=>'alert(1)')) as $trigger){$rule=$this->rule();$rule['triggers']=array($trigger);$this->assertInstanceOf(WP_Error::class,Validator::validate($rule));}
  $rule=$this->rule();$rule['platforms']['meta']['params']=array('total'=>'{arbitrary_php}');$this->assertInstanceOf(WP_Error::class,Validator::validate($rule));
  $rule['platforms']['meta']['params']=array('total'=>'{woo_cart_total}');$this->assertIsArray(Validator::validate($rule));
  $rule['platforms']['meta']['params']=array('coupon'=>'{url_param:coupon}','title'=>'{post_title}');$this->assertIsArray(Validator::validate($rule));
  $rule['platforms']['meta']['token']='secret';$this->assertInstanceOf(WP_Error::class,Validator::validate($rule));
 }
 public function test_crud_compiles_cache_and_pause_duplicate_delete_are_independent(): void {
  $this->assertTrue(class_exists(Rules::class));\PixelPair\Settings\Migrations::run();$repo=new Rules();$created=$repo->save($this->rule());$this->assertIsArray($created);$id=$created['id'];
  try{$this->assertArrayHasKey($id,$repo->rules());$this->assertSame($repo->rules(),get_option('pixelpair_rules'));
   $created['status']='paused';$this->assertIsArray($repo->save($created,$id));$this->assertArrayNotHasKey($id,$repo->rules());
   $copy=$repo->duplicate($id);$this->assertNotSame($id,$copy['id']);$this->assertSame('paused',$copy['status']);$repo->delete($copy['id']);
  }finally{$repo->delete($id);}$this->assertArrayNotHasKey($id,$repo->rules());
 }
}
