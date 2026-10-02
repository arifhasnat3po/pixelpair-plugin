<?php
/** @package PixelPair */
/** @group edd */
use PixelPair\Commerce\{Delivery, Settings};
use PixelPair\Settings\{Repository, Secrets};
use PixelPair\Events\{Event, Queue, Tables};
use PixelPair\Support\Crypto;

/** @group edd */
final class ReleaseReviewTest extends LifecycleTestCase {
 private $orders = array();
 protected function setUp(): void {
  parent::setUp(); Tables::install(); Tables::clear();
  $store=Settings::defaults();$store['enabled']=true;
  (new Repository())->update(array('woocommerce'=>$store,'edd'=>$store,'meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>true,'meta_advanced_matching'=>true,'tiktok_enabled'=>true,'tiktok_pixel_id'=>'C1234567890ABCDEFGHI','tiktok_capi_enabled'=>true,'tiktok_advanced_matching'=>true));
  foreach(array('meta','tiktok') as $p){(new Secrets($p))->update(array('token'=>wp_generate_password(24,false)));}
 }
 protected function tearDown(): void {
  foreach($this->orders as $key){list($p,$id)=explode(':',$key);if('woo'===$p){$o=wc_get_order((int)$id);if($o){$o->delete(true);}}else{edd_delete_order((int)$id);}}
  Tables::clear();delete_option('pixelpair_secrets');delete_option('pixelpair_tiktok_secrets');parent::tearDown();
 }
 private function order(string $provider,string $email='review@example.test',int $user=0): int {
  $context=array('marketing'=>true,'statistics'=>true,'captured_at'=>time(),'matching'=>array('em'=>array(hash('sha256',$email)),'external_id'=>array(hash('sha256','baseline'))),'tiktok_matching'=>array('em'=>array(hash('sha256',$email)),'external_id'=>array(hash('sha256','baseline'))));
  if('woo'===$provider){$o=wc_create_order(array('customer_id'=>$user));$o->set_billing_email($email);$o->set_status('processing');$o->update_meta_data('_pixelpair_context',Crypto::encrypt(wp_json_encode($context)));$o->save();$id=$o->get_id();}
  else{$id=edd_add_order(array('status'=>'complete','type'=>'sale','email'=>$email,'user_id'=>$user,'currency'=>'USD','total'=>5));edd_update_order_meta($id,'_pixelpair_context',Crypto::encrypt(wp_json_encode($context)));}
  $this->orders[]=$provider.':'.$id;return $id;
 }
 private function context(string $p,int $id): array {return 'woo'===$p?\PixelPair\Integrations\WooCommerce\Integration::context(wc_get_order($id)):\PixelPair\Integrations\EDD\Integration::context(edd_get_order($id));}
 private function queue(string $p,int $id): void {Delivery::enqueue($p.':purchase:'.$id,$p.'_purchase',array('value'=>5,'currency'=>'USD','items'=>array(array('item_id'=>'item','price'=>5,'quantity'=>1))),$this->context($p,$id));}
 private function jobs(): array {global $wpdb;return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}pixelpair_jobs ORDER BY id",ARRAY_A);}
 public function test_saved_and_queued_contact_hashes_follow_current_matching_settings(): void {
  foreach(array('before','after') as $when){Tables::clear();(new Repository())->update(array('meta_advanced_matching'=>true,'tiktok_advanced_matching'=>true));$id=$this->order('woo');
   if('before'===$when){(new Repository())->update(array('meta_advanced_matching'=>false,'tiktok_advanced_matching'=>false));}$this->queue('woo',$id);
   (new Repository())->update(array('meta_advanced_matching'=>false,'tiktok_advanced_matching'=>false));$sent=array();$stub=static function($pre,$args)use(&$sent){$sent[]=json_decode($args['body'],true)['data'][0];return array('response'=>array('code'=>200),'body'=>'{"events_received":1,"code":0}','headers'=>array());};add_filter('pre_http_request',$stub,10,2);
   try{foreach($this->jobs() as $job){(new Queue())->run((int)$job['id']);}}finally{remove_filter('pre_http_request',$stub);}
   $this->assertCount(2,$sent);foreach($sent as $payload){$user=$payload['user_data']??$payload['user'];$this->assertArrayNotHasKey('em',$user);$this->assertArrayNotHasKey('email',$user);$this->assertArrayHasKey('external_id',$user);}
  }
 }
 public function test_erasure_clears_pending_and_retry_jobs_only_for_the_requested_customer(): void {
  foreach(array('woo','edd') as $provider){$id=$this->order($provider);$this->queue($provider,$id);$other=$this->order($provider,'unrelated@example.test');$this->queue($provider,$other);}
  global $wpdb;$jobs=$this->jobs();$wpdb->update($wpdb->prefix.'pixelpair_jobs',array('attempts'=>1),array('id'=>$jobs[0]['id']));
  (new \PixelPair\Privacy\Integration())->erase('review@example.test');
  $cancelled=array_filter($this->jobs(),static function($row){return 'cancelled'===$row['status'] && ''===$row['payload'];});$this->assertCount(4,$cancelled);
  $pending=array_filter($this->jobs(),static function($row){return 'pending'===$row['status'];});$this->assertCount(4,$pending);
 }
 public function test_changed_customer_exclusions_block_background_purchases(): void {
  $user=get_user_by('login','subscriber');$this->assertNotFalse($user);
  foreach(array('woo','edd') as $provider){$id=$this->order($provider,'role@example.test',$user->ID);(new Repository())->update(array('excluded_roles'=>array('subscriber')));$this->queue($provider,$id);$this->assertCount(0,$this->jobs());(new Repository())->update(array('excluded_roles'=>array()));}
 }
 public function test_changed_owner_role_cancels_already_queued_purchases(): void {
  $user_id=wp_create_user('review-role-'.wp_generate_password(8,false),wp_generate_password());$user=new WP_User($user_id);$user->set_role('subscriber');
  try{foreach(array('woo','edd') as $p){$id=$this->order($p,'role-change@example.test',$user_id);$this->queue($p,$id);}$user->set_role('editor');(new Repository())->update(array('excluded_roles'=>array('editor')));$calls=0;$stub=static function()use(&$calls){++$calls;return new WP_Error('unexpected');};add_filter('pre_http_request',$stub);try{foreach($this->jobs() as $job){(new Queue())->run((int)$job['id']);}}finally{remove_filter('pre_http_request',$stub);}$this->assertSame(0,$calls);foreach($this->jobs() as $job){$this->assertSame('cancelled',$job['status']);$this->assertSame('',$job['payload']);}}
  finally{require_once ABSPATH.'wp-admin/includes/user.php';wp_delete_user($user_id);}
 }
 public function test_paid_order_totals_survive_missing_catalog_products(): void {
  $p=new WC_Product_Simple();$p->set_name('Deleted product');$p->set_regular_price('12');$p->save();$id=$this->order('woo');$o=wc_get_order($id);$o->add_product($p,2);$o->calculate_totals();$p->delete(true);
  $snapshot=\PixelPair\Integrations\WooCommerce\Data::order(wc_get_order($id));$this->assertSame(24.0,$snapshot['value']);$this->assertCount(1,$snapshot['items']);$this->assertSame('Deleted product',$snapshot['items'][0]['item_name']);
 }
 public function test_received_receipt_revocation_cancels_retries_and_future_purchase(): void {
  foreach(array('woo','edd') as $p){Tables::clear();$id=$this->order($p);$this->queue($p,$id);global $wpdb;$wpdb->query("UPDATE {$wpdb->prefix}pixelpair_jobs SET attempts=1");
   if('woo'===$p){$o=wc_get_order($id);$url=home_url('/?key='.$o->get_order_key());}
   else{$o=edd_get_order($id);$payment_key=md5(wp_generate_uuid4());edd_update_order($id,array('payment_key'=>$payment_key));EDD()->session->set('edd_purchase',array('purchase_key'=>$payment_key));$url=home_url('/?payment_key='.$payment_key);}
   $d=array('provider'=>$p,'action'=>'purchase','url'=>$url,'event_id'=>wp_generate_uuid4(),'targets'=>array('meta','tiktok'),'consent'=>array('marketing'=>array('granted'=>false,'source'=>'default'),'statistics'=>array('granted'=>true,'source'=>'default')));
   $r=(new \PixelPair\Commerce\Controller())->evaluate(wp_json_encode($d),home_url());$this->assertIsArray($r);$this->assertFalse($this->context($p,$id)['marketing']);
   foreach($this->jobs() as $job){$this->assertSame('cancelled',$job['status']);$this->assertSame('',$job['payload']);}
   $this->queue($p,$id);$this->assertCount(2,$this->jobs());
  }
 }
 public function test_unresolved_receipt_does_not_become_permanent_order_revocation(): void {
  $id=$this->order('woo');$o=wc_get_order($id);$d=array('provider'=>'woo','action'=>'purchase','url'=>home_url('/?key='.$o->get_order_key()),'event_id'=>wp_generate_uuid4(),'targets'=>array(),'consent'=>array('marketing'=>array('granted'=>false,'source'=>'unresolved'),'statistics'=>array('granted'=>true,'source'=>'default')));
  (new \PixelPair\Commerce\Controller())->evaluate(wp_json_encode($d),home_url());$this->assertTrue($this->context('woo',$id)['marketing']);
 }
 public function test_cart_total_template_uses_server_cart_for_both_destinations(): void {
  if(!WC()->cart){wc_load_cart();}WC()->cart->empty_cart();$p=new WC_Product_Simple();$p->set_name('Cart token');$p->set_regular_price('12');$p->save();
  try{WC()->cart->add_to_cart($p->get_id(),2);WC()->cart->calculate_totals();$s=(new Repository())->get();foreach(array('meta','tiktok') as $platform){$s['automatic_events']['form_submit']['platforms'][$platform]['enabled']=true;$s['automatic_events']['form_submit']['platforms'][$platform]['params']=array('value'=>'{woo_cart_total}');}(new Repository())->update(array('automatic_events'=>$s['automatic_events']));
   $event=new Event('form_submit',wp_generate_uuid4(),time(),home_url(),array('value'=>'999999'));foreach(array('meta','tiktok') as $platform){$mapped=\PixelPair\Events\Mapping::event($event,$platform);$this->assertSame((string)\PixelPair\Integrations\WooCommerce\Data::cart()['value'],$mapped['params']['value']);}
  }finally{WC()->cart->empty_cart();$p->delete(true);}
 }
}
