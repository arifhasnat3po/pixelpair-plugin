<?php
/** Real WooCommerce fixture tests. @package PixelPair */
use PixelPair\Commerce\{Settings,Claims,Consent};
use PixelPair\Integrations\WooCommerce\{Data,Integration};
use PixelPair\Settings\Repository;
/** @group commerce */
final class WooCommerceTest extends LifecycleTestCase {
	public function test_receipt_script_requires_paid_owner_and_current_consent(): void {
		$o=wc_create_order();$this->orders[]=$o;$o->set_total(12.5);$o->save();
		$s=\PixelPair\Scripts\Repository::defaults();$s['receipt']['code']='window.receipt={order_id};';update_option('pixelpair_scripts',$s);
		$request=new WP_REST_Request('POST');$request->set_header('origin',home_url());
		$body=array('url'=>home_url('/checkout/order-received/'.$o->get_id().'/?key='.$o->get_order_key()),'category'=>'marketing','consent'=>array('granted'=>true,'source'=>'integration'));
		$request->set_body(wp_json_encode($body));$controller=new \PixelPair\Scripts\Controller();
		try {
			$this->assertSame(403,$controller->receipt($request)->get_status());
			$o->set_status('processing');$o->save();$response=$controller->receipt($request);$this->assertSame(200,$response->get_status());$this->assertSame('window.receipt='.$o->get_id().';',$response->get_data()['code']);
			$o->set_customer_id(999999);$o->save();$this->assertSame(403,$controller->receipt($request)->get_status());
			$o->set_customer_id(0);$o->save();$body['consent']['granted']=false;$request->set_body(wp_json_encode($body));$this->assertSame(403,$controller->receipt($request)->get_status());
			$request->set_header('origin','https://evil.example');$this->assertSame(403,$controller->receipt($request)->get_status());
		} finally {delete_option('pixelpair_scripts');}
	}
	private $products=array(); private $orders=array();
	protected function setUp(): void {
		parent::setUp();$this->assertTrue(class_exists('WooCommerce'),'Run this group on the documented WooCommerce fixture.');
		$s=Settings::defaults();$s['enabled']=true;(new Repository())->update(array('woocommerce'=>$s));
		$_SERVER['REMOTE_ADDR']='192.0.2.10';$_SERVER['HTTP_USER_AGENT']='Mozilla/5.0 Test Browser';
	}
	private function product(string $price='10'): WC_Product_Simple {$p=new WC_Product_Simple();$p->set_name('Test shirt');$p->set_regular_price($price);$p->set_sku('TP-'.wp_generate_password(8,false));$p->save();$this->products[]=$p;return $p;}
	protected function tearDown(): void {foreach($this->orders as $o){$o->delete(true);}foreach(array_reverse($this->products) as $p){$p->delete(true);}unset($_COOKIE['pixelpair_commerce_consent']);parent::tearDown();}
	public function test_identifiers_variations_quantities_and_value_percent(): void {
		$p=$this->product('12.5');$s=Settings::get('woo');$s['include_tax']=false;$s['content_id']='sku';$s['id_prefix']='wc_';$s['id_suffix']='_feed';$s['non_purchase_percent']=50;(new Repository())->update(array('woocommerce'=>$s));
		$d=Data::product($p,2);$this->assertSame('wc_'.$p->get_sku().'_feed',$d['items'][0]['item_id']);$this->assertSame(12.5,$d['value']);$this->assertSame(2,$d['items'][0]['quantity']);
		$currency=static function(){return 'EUR';};add_filter('woocommerce_currency',$currency);try{$this->assertSame('EUR',Data::product($p,1)['currency']);}finally{remove_filter('woocommerce_currency',$currency);}
		$parent=new WC_Product_Variable();$parent->set_name('Variable');$parent->save();$this->products[]=$parent;
		$v=new WC_Product_Variation();$v->set_parent_id($parent->get_id());$v->set_regular_price('9');$v->save();$this->products[]=$v;
		$s['content_id']='id';$s['parent_ids']=true;(new Repository())->update(array('woocommerce'=>$s));
		$this->assertSame('wc_'.$parent->get_id().'_feed',Data::product($v,1)['items'][0]['item_id']);
		$parent->set_sku('PARENT-'.wp_generate_password(6,false));$parent->save();$v=wc_get_product($v->get_id());$s['parent_ids']=false;$s['content_id']='sku';(new Repository())->update(array('woocommerce'=>$s));$this->assertSame('wc_'.$v->get_id().'_feed',Data::content_id($v));
	}
	public function test_discounted_order_values_fees_shipping_and_currency(): void {
		$p=$this->product();$o=wc_create_order();$this->orders[]=$o;$o->add_product($p,2,array('subtotal'=>20,'total'=>15));
		$ship=new WC_Order_Item_Shipping();$ship->set_method_title('Test delivery');$ship->set_total(3);$o->add_item($ship);
		$fee=new WC_Order_Item_Fee();$fee->set_name('Packing');$fee->set_amount(2);$fee->set_total(2);$o->add_item($fee);$o->set_currency('EUR');$o->calculate_totals(false);$o->save();
		$d=Data::order($o);$this->assertSame(20.0,$d['value']);$this->assertSame('EUR',$d['currency']);$this->assertSame(7.5,$d['items'][0]['price']);
		$s=Settings::get('woo');$s['include_shipping']=false;$s['include_fees']=false;(new Repository())->update(array('woocommerce'=>$s));
		$this->assertSame(15.0,Data::order($o)['value']);
	}
	public function test_purchase_receipt_requires_paid_order_key_and_correct_owner(): void {
		$o=wc_create_order();$this->orders[]=$o;$o->add_product($this->product(),1);$o->calculate_totals();$o->save();
		$this->assertNull(Data::receipt('wrong'));$this->assertNull(Data::receipt($o->get_order_key()));
		$o->set_status('processing');$o->save();$this->assertSame($o->get_id(),Data::receipt($o->get_order_key())->get_id());
		$o->set_customer_id(999999);$o->save();$this->assertNull(Data::receipt($o->get_order_key()));
	}
	public function test_payment_callbacks_share_a_persisted_id_and_do_not_repeat_jobs(): void {
		$this->assertTrue(class_exists(Integration::class));\PixelPair\Events\Tables::install();\PixelPair\Events\Tables::clear();
		(new Repository())->update(array('meta_enabled'=>true,'meta_capi_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
		$o=wc_create_order();$this->orders[]=$o;$o->add_product($this->product(),1);$o->calculate_totals();$o->save();
		$service=new Integration();$service->capture_order($o);$o->set_status('processing');$o->save();
		$service->purchase($o->get_id());$service->purchase($o->get_id());
		$key='woo:purchase:'.$o->get_id();$this->assertTrue(Claims::server_done($key,'meta'));
		global $wpdb;$this->assertSame(1,(int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}pixelpair_jobs"));
		$context=$o->get_meta('_pixelpair_context');$this->assertIsString($context);$this->assertStringNotContainsString('192.0.2.10',$context);
	}
	public function test_denial_and_renewals_do_not_create_purchase_delivery(): void {
		$this->assertTrue(class_exists(Consent::class));$_COOKIE['pixelpair_commerce_consent']=wp_json_encode(array('marketing'=>array('granted'=>false,'source'=>'integration'),'statistics'=>array('granted'=>false,'source'=>'integration')));
		$this->assertFalse(Consent::current()['marketing']);
		$o=wc_create_order();$this->orders[]=$o;$o->set_status('processing');$o->save();(new Integration())->capture_order($o);(new Integration())->purchase($o->get_id());
		$this->assertFalse(Claims::server_done('woo:purchase:'.$o->get_id(),'meta'));
		$o->update_meta_data('_subscription_renewal',55);$o->save();$this->assertFalse((new Integration())->renewal_allowed($o));$s=Settings::get('woo');$s['renewals']=true;(new Repository())->update(array('woocommerce'=>$s));$this->assertTrue((new Integration())->renewal_allowed($o));
	}
}
