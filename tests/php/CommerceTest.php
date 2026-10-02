<?php
/** @package PixelPair */
use PixelPair\Commerce\{Claims,Payload,Settings};
use PixelPair\Events\{Event,Mapping,Tables};
use PixelPair\Settings\Repository;

final class CommerceTest extends LifecycleTestCase {
	public function test_refunds_cannot_be_enabled_without_a_supported_delivery_path(): void {
		$settings = Settings::defaults();
		$settings['events']['refund'] = true;
		$this->assertFalse( Settings::valid( $settings ) );
	}
	public function test_sensitive_mode_removes_catalog_details_and_ephemeral_claims_expire(): void {
		Tables::install();$store=Settings::defaults();$store['enabled']=true;(new Repository())->update(array('woocommerce'=>$store,'meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_sensitive_data'=>true));
		$r=\PixelPair\Commerce\Delivery::browser('woo:page:'.wp_generate_uuid4(),'woo_view_item',array('value'=>9,'currency'=>'USD','items'=>array(array('item_id'=>'sensitive-item','price'=>9,'quantity'=>1))),array('marketing'=>true,'captured_at'=>time()),array('meta'));
		$this->assertArrayNotHasKey('contents',$r['platforms']['meta']['params']);
		$this->assertTrue(method_exists(Claims::class,'purge'));$page='woo:page:'.wp_generate_uuid4();$purchase='woo:purchase:'.wp_generate_uuid4();$a=Claims::id($page);$b=Claims::id($purchase);global $wpdb;
		$wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}pixelpair_claims SET expires_at=%d WHERE expires_at>0",time()-1));Claims::purge();$this->assertNotSame($a,Claims::id($page));$this->assertSame($b,Claims::id($purchase));
	}
	public function test_general_collector_cannot_forge_commerce_purchase_values(): void {
		$store=Settings::defaults();$store['enabled']=true;(new Repository())->update(array('woocommerce'=>$store,'meta_enabled'=>true,'meta_capi_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
		$body=wp_json_encode(array('event_name'=>'woo_purchase','expected_name'=>'Purchase','event_id'=>wp_generate_uuid4(),'source_url'=>home_url('/'),'params'=>(object)array('value'=>999999),'consent'=>(object)array('granted'=>true,'source'=>'default')));
		$result=(new \PixelPair\Events\CollectorController())->evaluate($body,home_url('/'),'POST');
		$this->assertWPErrorCommerce($result);
	}
	private function assertWPErrorCommerce($result): void {$this->assertInstanceOf(WP_Error::class,$result);$this->assertSame(400,$result->get_error_data()['status']);}
	public function test_store_settings_are_strict_and_disabled_until_enabled(): void {
		$this->assertFalse( Settings::defaults()['enabled'] );
		$settings = Settings::defaults();
		$this->assertTrue( Settings::valid( $settings ) );
		$settings['list_limit'] = 201;
		$this->assertFalse( Settings::valid( $settings ) );
		$settings = Settings::defaults(); $settings['non_purchase_percent'] = -1;
		$this->assertFalse( Settings::valid( $settings ) );
		$settings = Settings::defaults(); $settings['id_prefix'] = '<script>';
		$this->assertFalse( Settings::valid( $settings ) );
		$settings = Settings::defaults(); $settings['events']['purchase'] = 'yes';
		$this->assertFalse( Settings::valid( $settings ) );
	}
	public function test_claims_share_one_id_and_atomically_consume_each_destination(): void {
		$this->assertTrue( class_exists( Claims::class ), 'Commerce claim service missing.' );
		Tables::install();
		$key = 'woo:purchase:' . wp_generate_uuid4();
		$id = Claims::id( $key );
		$this->assertMatchesRegularExpression( '/^[a-f0-9-]{36}$/', $id );
		$this->assertSame( $id, Claims::id( $key ) );
		$this->assertNotSame( $id, Claims::id( str_replace( 'woo:', 'edd:', $key ) ) );
		$this->assertTrue( Claims::claim_browser( $key, 'meta' ) );
		$this->assertFalse( Claims::claim_browser( $key, 'meta' ) );
		$this->assertTrue( Claims::claim_browser( $key, 'ga4' ) );
		$this->assertFalse( Claims::server_done( $key, 'meta' ) );
		Claims::mark_server( $key, 'meta' );
		$this->assertTrue( Claims::server_done( $key, 'meta' ) );
		$this->assertFalse( Claims::server_done( $key, 'tiktok' ) );
	}
	public function test_commerce_payload_keeps_structured_items_and_bounds_them(): void {
		$snapshot = array( 'value'=>24.5, 'currency'=>'USD', 'transaction_id'=>'order-1', 'items'=>array(array('item_id'=>'SKU-7','item_name'=>'Shirt','price'=>12.25,'quantity'=>2,'email'=>'private@example.test')) );
		$ga = Payload::map( $snapshot, 'ga4' );
		$this->assertSame( 'SKU-7', $ga['items'][0]['item_id'] );
		$this->assertArrayNotHasKey( 'email', $ga['items'][0] );
		$meta = Payload::map( $snapshot, 'meta' );
		$this->assertSame( array('SKU-7'), $meta['content_ids'] );
		$this->assertSame( array(array('id'=>'SKU-7','quantity'=>2,'item_price'=>12.25)), $meta['contents'] );
		$this->assertSame( 24.5, $meta['value'] );
		$snapshot['items'] = array_fill(0,250,$snapshot['items'][0]);
		$this->assertCount( 200, Payload::map($snapshot,'ga4')['items'] );
	}
	public function test_commerce_mapping_requires_enabled_store_and_keeps_verified_items(): void {
		$this->assertTrue(class_exists(Settings::class));
		$store=Settings::defaults(); $store['enabled']=true;
		(new Repository())->update(array('woocommerce'=>$store));
		$event=new Event('woo_purchase',wp_generate_uuid4(),time(),home_url('/'),array('value'=>5,'currency'=>'USD','items'=>array(array('item_id'=>'7','price'=>5,'quantity'=>1))));
		$this->assertSame('Purchase',Mapping::get('woo_purchase','meta')['name']);
		$this->assertSame('7',Mapping::event($event,'meta')['params']['contents'][0]['id']);
		$store['events']['purchase']=false; (new Repository())->update(array('woocommerce'=>$store));
		$this->assertNull(Mapping::get('woo_purchase','meta'));
	}
}
