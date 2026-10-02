<?php
/** @package PixelPair */
/** @group edd */
final class PrivacyTest extends LifecycleTestCase {
	public function test_receipt_credentials_are_removed_from_explicit_vendor_urls(): void {
		$url='https://example.test/receipt/?payment_key=private&order=receipt-hash&key=order-key&campaign=autumn#private';
		$e=new \PixelPair\Events\Event('page_view',wp_generate_uuid4(),time(),$url);
		$this->assertSame('https://example.test/receipt/?campaign=autumn',$e->source_url);
	}
 public function test_export_and_erasure_are_email_scoped_and_keep_commerce_records(): void {
  $this->assertTrue(class_exists(\PixelPair\Privacy\Integration::class));$email='privacy-'.wp_generate_password(6,false).'@example.test';$orders=array();
  try {
   foreach(array($email,'other@example.test') as $address){$o=wc_create_order();$o->set_billing_email($address);$o->update_meta_data('_pixelpair_attribution',array('utm_source'=>'test'));$o->update_meta_data('_pixelpair_context','encrypted');$o->save();$orders[]=$o;}
   $id=edd_add_order(array('status'=>'complete','type'=>'sale','email'=>$email,'currency'=>'USD','total'=>5));edd_update_order_meta($id,'_pixelpair_attribution',array('utm_source'=>'edd'));edd_update_order_meta($id,'_pixelpair_context','encrypted');
   $service=new \PixelPair\Privacy\Integration();$export=$service->export($email,1);$this->assertCount(2,$export['data']);$this->assertTrue($export['done']);$this->assertStringNotContainsString('encrypted',wp_json_encode($export));
   $erased=$service->erase($email,1);$this->assertTrue($erased['items_removed']);$this->assertTrue($erased['done']);$this->assertSame('',$orders[0]->get_meta('_pixelpair_attribution',true,'edit')==='x'?'x':wc_get_order($orders[0]->get_id())->get_meta('_pixelpair_attribution'));
   $this->assertNotEmpty(wc_get_order($orders[1]->get_id())->get_meta('_pixelpair_attribution'));$this->assertSame('',edd_get_order_meta($id,'_pixelpair_context',true));$this->assertNotFalse(edd_get_order($id));
  } finally {foreach($orders as $order){$order->delete(true);}if(isset($id)){edd_delete_order($id);}}
 }
}
