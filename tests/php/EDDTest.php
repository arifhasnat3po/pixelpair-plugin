<?php
/** @package PixelPair */
use PixelPair\Commerce\{Settings,Claims};
use PixelPair\Integrations\EDD\{Data,Integration};
/** @group edd */
final class EDDTest extends LifecycleTestCase {
 private $products=array(); private $orders=array();
 protected function setUp(): void { parent::setUp(); $this->assertTrue(function_exists('edd_get_order'),'EDD 3.x fixture required; pairing unsupported or dependency absent.'); wp_set_current_user(0); $s=Settings::defaults();$s['enabled']=true;(new PixelPair\Settings\Repository())->update(array('edd'=>$s)); }
 protected function tearDown(): void { foreach($this->orders as $id)edd_destroy_order($id);foreach($this->products as $id)wp_delete_post($id,true);edd_empty_cart();parent::tearDown(); }
 private function product(): int { $id=wp_insert_post(array('post_type'=>'download','post_status'=>'publish','post_title'=>'Download fixture'));$this->products[]=$id;update_post_meta($id,'edd_price','10');update_post_meta($id,'edd_sku','BOOK');return $id; }
 private function order(int $product,string $status='complete'): int { $id=edd_add_order(array('status'=>$status,'type'=>'sale','email'=>'buyer@example.test','payment_key'=>md5(wp_generate_uuid4()),'currency'=>'EUR','subtotal'=>20,'discount'=>5,'tax'=>1.5,'total'=>16.5));$this->orders[]=$id;edd_add_order_item(array('order_id'=>$id,'product_id'=>$product,'product_name'=>'Saved title','quantity'=>2,'amount'=>10,'subtotal'=>20,'discount'=>5,'tax'=>1.5,'total'=>16.5));return $id; }
 public function test_variable_catalog_prices_ids_quantity_and_percentage(): void {
  $this->assertTrue(class_exists(Data::class));$id=$this->product();update_post_meta($id,'_variable_pricing',1);update_post_meta($id,'edd_variable_prices',array(array('name'=>'Basic','amount'=>'10'),array('name'=>'Pro','amount'=>'25')));
  $s=Settings::get('edd');$s['content_id']='sku';$s['id_prefix']='shop_';$s['id_suffix']='_end';$s['non_purchase_percent']=50;(new PixelPair\Settings\Repository())->update(array('edd'=>$s));
  $p=Data::product($id,2,1);$this->assertSame('shop_BOOK_1_end',$p['items'][0]['item_id']);$this->assertEquals(25,$p['value']);$this->assertSame('Pro',$p['items'][0]['item_variant']);
  $s['parent_ids']=true;(new PixelPair\Settings\Repository())->update(array('edd'=>$s));$this->assertSame('shop_BOOK_end',Data::product($id,1,1)['items'][0]['item_id']);
  $this->assertNull(Data::product($id,1,99));
 }
 public function test_paid_receipt_requires_native_authority_and_uses_order_totals(): void {
  $this->assertTrue(class_exists(Data::class));$id=$this->order($this->product());$order=edd_get_order($id);
  $this->assertNull(Data::receipt(array('payment_key'=>$order->payment_key)));
  EDD()->session->set('edd_purchase',array('purchase_key'=>$order->payment_key));
  $this->assertSame($id,(int)Data::receipt(array('payment_key'=>$order->payment_key))->id);
  $data=Data::order($order);$this->assertEquals(16.5,$data['value']);$this->assertSame('EUR',$data['currency']);$this->assertSame('edd_'.$id,$data['transaction_id']);$this->assertEquals(2,$data['items'][0]['quantity']);
  $s=Settings::get('edd');$s['include_tax']=false;(new PixelPair\Settings\Repository())->update(array('edd'=>$s));$this->assertEquals(15,Data::order($order)['value']);
  edd_update_order($id,array('status'=>'pending'));$this->assertNull(Data::receipt(array('payment_key'=>$order->payment_key)));
 }
 public function test_confirmed_cart_hook_and_duplicate_completion_preserve_identity(): void {
  $this->assertTrue(class_exists(Integration::class));$id=$this->product();$settings=(new PixelPair\Settings\Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>true));$this->assertIsArray($settings);
  edd_add_to_cart($id);$pending=EDD()->session->get('pixelpair_pending');$this->assertCount(1,$pending);$this->assertEquals(10,$pending[0]['snapshot']['value']);
  $order=$this->order($id);$integration=new Integration();$integration->capture_order($order);$integration->purchase($order);$uuid=Claims::id('edd:purchase:'.$order);$integration->purchase($order);$this->assertSame($uuid,Claims::id('edd:purchase:'.$order));$this->assertTrue(Claims::server_done('edd:purchase:'.$order,'meta'));
  $this->assertNotSame($uuid,Claims::id('woo:purchase:'.$order));
  edd_update_order($order,array('status'=>'refunded'));$this->assertFalse(Integration::paid(edd_get_order($order)));
 }
}
