<?php
/** @package PixelPair */
use PixelPair\Commerce\{Controller,Settings};
use PixelPair\Settings\Repository;
/** @group commerce */
final class CommerceControllerTest extends LifecycleTestCase {
	private $product;
	protected function setUp(): void {parent::setUp();$this->assertTrue(class_exists('WooCommerce'),'WooCommerce fixture required.');$s=Settings::defaults();$s['enabled']=true;(new Repository())->update(array('woocommerce'=>$s,'meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','ga4_enabled'=>true,'ga4_ids'=>array('G-TEST123')));$this->product=new WC_Product_Simple();$this->product->set_name('Verified product');$this->product->set_regular_price('7');$this->product->set_status('publish');$this->product->save();$_SERVER['REMOTE_ADDR']='192.0.2.60';$_SERVER['HTTP_USER_AGENT']='Mozilla/5.0';\PixelPair\Events\Tables::install();}
	protected function tearDown(): void {$this->product->delete(true);parent::tearDown();}
	private function body(array $changes=array()): string {return wp_json_encode(array_replace(array('provider'=>'woo','action'=>'view_item','url'=>get_permalink($this->product->get_id()),'product_id'=>$this->product->get_id(),'event_id'=>wp_generate_uuid4(),'targets'=>array('meta','ga4'),'consent'=>array('marketing'=>array('granted'=>true,'source'=>'default'),'statistics'=>array('granted'=>true,'source'=>'default'))),$changes));}
	public function test_endpoint_derives_prices_and_does_not_return_matching_data(): void {
		$this->assertTrue(class_exists(Controller::class));$r=(new Controller())->evaluate($this->body(),home_url('/'));$this->assertIsArray($r);$event=$r['events'][0];$this->assertSame(7.0,$event['platforms']['ga4']['params']['value']);$this->assertSame('ViewContent',$event['platforms']['meta']['name']);$this->assertStringNotContainsString('matching',wp_json_encode($r));
		$this->assertInstanceOf(WP_Error::class,(new Controller())->evaluate($this->body(array('value'=>1)),home_url('/')));
	}
	public function test_checkout_payment_choice_is_validated_against_available_gateways(): void {
		wc_load_cart();WC()->cart->empty_cart();WC()->cart->add_to_cart($this->product->get_id());
		try {
			$c=new Controller();$body=$this->body(array('action'=>'add_payment_info','payment_method'=>'not-a-gateway'));$this->assertInstanceOf(WP_Error::class,$c->evaluate($body,home_url('/')));
			update_option('woocommerce_cod_settings',array('enabled'=>'yes','enable_for_virtual'=>'yes'));WC()->payment_gateways()->payment_gateways()['cod']->enabled='yes';
			$r=$c->evaluate($this->body(array('action'=>'add_payment_info','payment_method'=>'cod')),home_url('/'));
			$this->assertIsArray($r);$this->assertSame('cod',$r['events'][0]['platforms']['ga4']['params']['payment_type']);
		} finally { WC()->cart->empty_cart(); }
	}
	public function test_snapshot_without_a_cart_session_cannot_replace_a_concurrent_cart_cookie(): void {
		wc_load_cart(); $previous = WC()->session;
		$session = new class extends WC_Session_Handler {
			public $cookie_writes = 0;
			public function has_session() { return false; }
			public function set_customer_session_cookie( $set ) { ++$this->cookie_writes; }
		};
		WC()->session = $session;
		try {
			foreach ( array( 'pending', 'context' ) as $action ) {
				$result = (new Controller())->evaluate($this->body(array('action'=>$action,'attribution'=>array('utm_source'=>'fixture'))),home_url('/'));
				$this->assertIsArray($result); $this->assertSame(array(), $result['events']);
				$this->assertSame(0, $session->cookie_writes, 'Read-only snapshots must not mint a competing cart session.');
				$this->assertNull($session->get('pixelpair_attribution'));
			}
		} finally { WC()->session = $previous; }
	}
	public function test_forged_origins_denial_unpublished_products_and_duplicate_page_ids(): void {
		$this->assertTrue(class_exists(Controller::class));$c=new Controller();$body=$this->body();$this->assertInstanceOf(WP_Error::class,$c->evaluate($body,'https://foreign.example'));
		$this->assertInstanceOf(WP_Error::class,$c->evaluate($this->body(array('consent'=>array('marketing'=>array('granted'=>false,'source'=>'integration'),'statistics'=>array('granted'=>false,'source'=>'integration')))),home_url('/')));
		$first=$c->evaluate($body,home_url('/'));$second=$c->evaluate($body,home_url('/'));$this->assertNotEmpty($first['events'][0]['platforms']);$this->assertEmpty($second['events'][0]['platforms']);
		$this->product->set_status('draft');$this->product->save();$this->assertInstanceOf(WP_Error::class,$c->evaluate($this->body(),home_url('/')));
	}
}
