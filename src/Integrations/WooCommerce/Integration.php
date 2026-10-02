<?php
/**
 * WooCommerce lifecycle adapters, including Store API checkout.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Integrations\WooCommerce;

use PixelPair\Commerce\{Settings, Consent, Delivery};
use PixelPair\Support\Crypto;
/**
 * Capture only confirmed commerce actions.
 */
final class Integration {

	/**
	 * Register optional integration hooks.
	 */
	public function register(): void {
		add_action( 'before_woocommerce_init', array( $this, 'compatibility' ) );
		add_action( 'woocommerce_add_to_cart', array( $this, 'added' ), 10, 4 );
		add_action( 'woocommerce_checkout_order_created', array( $this, 'capture_order' ) );
		add_action( 'woocommerce_store_api_checkout_order_processed', array( $this, 'capture_order' ) );
		add_action( 'woocommerce_payment_complete', array( $this, 'schedule_purchase' ) );
		add_action( 'woocommerce_order_status_processing', array( $this, 'schedule_purchase' ) );
		add_action( 'woocommerce_order_status_completed', array( $this, 'schedule_purchase' ) );
		add_action( 'pixelpair_woo_purchase', array( $this, 'purchase' ) );
		add_action( 'pixelpair_purchase_event', array( $this, 'purchase' ) );
		add_action( 'woocommerce_admin_order_data_after_order_details', array( $this, 'attribution_box' ) );
	}
	/**
	 * Declare tested storage and checkout integrations.
	 */
	public function compatibility(): void {
		if ( class_exists( 'Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', PIXELPAIR_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', PIXELPAIR_FILE, true );
		}
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $cart_key Cart line.
	 * @param int    $product_id Product.
	 * @param int    $quantity Added units.
	 * @param int    $variation_id Variation.
	 */
	public function added( string $cart_key, int $product_id, int $quantity, int $variation_id = 0 ): void {
		$s = Settings::get( 'woo' );
		/**
 * WooCommerce initializes this service only for relevant requests.
		 *
 * @var \WC_Session|null $session Optional session service.
 */
		$session = WC()->session;
		if ( ! $s['enabled'] || ! $s['events']['add_to_cart'] || ! $session ) {
			return;
		}
		$context = Consent::current();
		if ( ! $context['marketing'] && ! $context['statistics'] ) {
			return;
		}
		$p = wc_get_product( $variation_id ? $variation_id : $product_id );
		if ( ! $p ) {
			return;
		}
		$key      = 'woo:cart:' . wp_generate_uuid4();
		$snapshot = Data::product( $p, $quantity );
		if ( 'hook' === $s['add_to_cart_source'] ) {
			Delivery::enqueue( $key, 'woo_add_to_cart', $snapshot, $context );
		}
		$pending   = (array) \PixelPair\Settings\Migrations::session( WC()->session, 'pixelpair_pending', array() );
		$pending[] = array(
			'key'      => $key,
			'snapshot' => $snapshot,
			'expires'  => time() + 600,
		);
		WC()->session->set( 'pixelpair_pending', array_slice( $pending, -20 ) );
		if ( method_exists( $session, 'set_customer_session_cookie' ) ) {
			$session->set_customer_session_cookie( true ); }
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Order $order Created checkout order.
	 */
	public function capture_order( $order ): void {
		$s = Settings::get( 'woo' );
		if ( ! $s['enabled'] ) {
			return;
		}
		$context = Consent::current();
		if ( ! $context['marketing'] && ! $context['statistics'] ) {
			return;
		}
		if ( $context['marketing'] && ( new \PixelPair\Settings\Repository() )->get()['meta_advanced_matching'] ) {
			$billing             = array(
				'em'      => $order->get_billing_email(),
				'ph'      => $order->get_billing_phone(),
				'fn'      => $order->get_billing_first_name(),
				'ln'      => $order->get_billing_last_name(),
				'ct'      => $order->get_billing_city(),
				'st'      => $order->get_billing_state(),
				'zp'      => $order->get_billing_postcode(),
				'country' => $order->get_billing_country(),
			);
			$context['matching'] = array_replace( (array) ( $context['matching'] ?? array() ), \PixelPair\UserData\Normalizer::hashes( $billing ) );
		}
		if ( $context['marketing'] && ( new \PixelPair\Settings\Repository() )->get()['tiktok_advanced_matching'] ) {
			$context['tiktok_matching'] = array_replace(
				(array) ( $context['tiktok_matching'] ?? array() ),
				\PixelPair\UserData\Normalizer::hashes(
					array(
						'em' => $order->get_billing_email(),
						'ph' => $order->get_billing_phone(),
					)
				)
			);
		}
		try {
			$order->update_meta_data( '_pixelpair_context', Crypto::encrypt( (string) wp_json_encode( $context ) ) );
		} catch ( \Throwable $error ) {
			return;
		}
		/**
		 * Orders can also be created without a browser session.
		 *
		 * @var \WC_Session|null $session Optional checkout session.
		 */
		$session = WC()->session;
		if ( $s['attribution'] && $session ) {
			$a = \PixelPair\Settings\Migrations::session( $session, 'pixelpair_attribution', array() );
			$order->update_meta_data( '_pixelpair_attribution', Consent::attribution( is_array( $a ) ? $a : array(), $context['marketing'] ) );
		}
		$order->save();
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param int $id Paid order.
	 */
	public function schedule_purchase( int $id ): void {
		if ( Settings::get( 'woo' )['safety_net'] && ! wp_next_scheduled( 'pixelpair_woo_purchase', array( $id ) ) ) {
			wp_schedule_single_event( time() + 60, 'pixelpair_woo_purchase', array( $id ) );
		}
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param int $id Paid order.
	 */
	public function purchase( int $id ): void {
		if ( ! function_exists( 'wc_get_order' ) || ! Settings::get( 'woo' )['enabled'] ) {
			return;
		}
		$o = wc_get_order( $id );
		if ( ! $o || ! $o->is_paid() || ! $this->renewal_allowed( $o ) ) {
			return;
		}
		$context = self::context( $o );
		if ( ! Consent::retained( $context, 'marketing' ) ) {
			return;
		}
		Delivery::enqueue( 'woo:purchase:' . $id, 'woo_purchase', Data::order( $o ), $context );
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Order $order Order.
	 * @return bool Renewal permitted.
	 */
	public function renewal_allowed( $order ): bool {
		return Settings::get( 'woo' )['renewals'] || ! ( $order->get_meta( '_subscription_renewal' ) || ( function_exists( 'wcs_order_contains_renewal' ) && wcs_order_contains_renewal( $order ) ) );
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Order $order Order.
	 * @return array<string,mixed> Protected captured context.
	 */
	public static function context( $order ): array {
		$raw     = \PixelPair\Settings\Migrations::meta( 'woo', $order, '_pixelpair_context' );
		$plain   = is_string( $raw ) ? Crypto::decrypt( $raw ) : null;
		$context = $plain ? json_decode( $plain, true ) : array();
		return is_array( $context ) ? $context : array();
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Order $order Order currently viewed.
	 */
	public function attribution_box( $order ): void {
		if ( Settings::get( 'woo' )['hide_attribution'] || ! current_user_can( 'edit_shop_orders' ) ) {
			return;
		}
		$data = \PixelPair\Settings\Migrations::meta( 'woo', $order, '_pixelpair_attribution' );
		if ( ! is_array( $data ) || ! $data ) {
			return;
		}
		echo '<div class="order_data_column"><h3>' . esc_html__( 'PixelPair attribution', 'pixelpair' ) . '</h3><dl>';
		foreach ( $data as $key => $value ) {
			echo '<dt>' . esc_html( $key ) . '</dt><dd>' . esc_html( (string) $value ) . '</dd>';
		}
		echo '</dl></div>';
	}
}
