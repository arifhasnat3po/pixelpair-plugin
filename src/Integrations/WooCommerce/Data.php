<?php
/**
 * WooCommerce data through public product and order CRUD APIs.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Integrations\WooCommerce;

use PixelPair\Commerce\Settings;
/**
 * Authoritative store values; never accepts a browser price.
 */
final class Data {

	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Product $product Product or variation.
	 * @return string Catalog ID.
	 */
	public static function content_id( $product ): string {
		$s      = Settings::get( 'woo' );
		$chosen = $product;
		if ( $s['parent_ids'] && $product->get_parent_id() ) {
			$parent = wc_get_product( $product->get_parent_id() );
			$chosen = $parent ? $parent : $product;
		}
		$sku = $chosen->get_sku( 'edit' );
		$id  = 'sku' === $s['content_id'] && $sku ? $sku : (string) $chosen->get_id();
		return mb_substr( (string) apply_filters( 'pixelpair_content_id', $s['id_prefix'] . $id . $s['id_suffix'], $product, 'woo' ), 0, 100 );
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Product $product Product.
	 * @param int         $quantity Units.
	 * @param float       $price Unit price override.
	 * @return array<string,mixed> GA4 item.
	 */
	public static function item( $product, int $quantity, float $price = -1 ): array {
		$s     = Settings::get( 'woo' );
		$price = $price < 0 ? (float) ( $s['include_tax'] ? wc_get_price_including_tax( $product ) : wc_get_price_excluding_tax( $product ) ) : $price;
		$out   = array(
			'item_id'   => self::content_id( $product ),
			'item_name' => wp_strip_all_tags( $product->get_name() ),
			'price'     => round( $price, 6 ),
			'quantity'  => max( 1, min( 100000, $quantity ) ),
		);
		$id    = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
		$terms = get_the_terms( $id, 'product_cat' );
		if ( is_array( $terms ) && $terms ) {
			$term  = $terms[0];
			$ids   = array_reverse( get_ancestors( $term->term_id, 'product_cat', 'taxonomy' ) );
			$ids[] = $term->term_id;
			foreach ( array_slice( $ids, 0, 5 ) as $index => $term_id ) {
				$category = get_term( $term_id, 'product_cat' );
				if ( $category instanceof \WP_Term ) {
					$out[ 'item_category' . ( $index ? $index + 1 : '' ) ] = $category->name;
				}
			}
		}
		if ( taxonomy_exists( 'product_brand' ) ) {
			$brands = get_the_terms( $id, 'product_brand' );
			if ( is_array( $brands ) && $brands ) {
				$out['item_brand'] = $brands[0]->name;
			}
		}
		if ( $product instanceof \WC_Product_Variation ) {
			$out['item_variant'] = implode( ' / ', array_values( $product->get_variation_attributes() ) );
		}
		return $out;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Product $product Product.
	 * @param int         $quantity Units.
	 * @return array<string,mixed> Snapshot.
	 */
	public static function product( $product, int $quantity ): array {
		$s              = Settings::get( 'woo' );
		$item           = self::item( $product, $quantity );
		$item['price'] *= (float) $s['non_purchase_percent'] / 100;
		return array(
			'value'    => round( $item['price'] * $item['quantity'], 6 ),
			'currency' => get_woocommerce_currency(),
			'items'    => array( $item ),
		);
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @return array<string,mixed> Current session cart.
	 */
	public static function cart(): array {
		$s = Settings::get( 'woo' );
		/**
 * WooCommerce initializes this service only for relevant requests.
		 *
 * @var \WC_Cart|null $cart WooCommerce lazily initializes carts outside storefront requests.
 */
		$cart = WC()->cart;
		if ( ! $cart ) {
			return array();
		}
		$cart->calculate_totals();
		$items = array();
		$value = 0.0;
		foreach ( $cart->get_cart() as $line ) {
			$qty            = max( 1, (int) $line['quantity'] );
			$total          = (float) $line['line_total'] + ( $s['include_tax'] ? (float) $line['line_tax'] : 0 );
			$item           = self::item( $line['data'], $qty, $total / $qty );
			$item['price'] *= (float) $s['non_purchase_percent'] / 100;
			$items[]        = $item;
			$value         += $total;
		}
		if ( $s['include_shipping'] ) {
			$value += (float) $cart->get_shipping_total() + ( $s['include_tax'] ? (float) $cart->get_shipping_tax() : 0 );
		}
		if ( $s['include_fees'] ) {
			$value += (float) $cart->get_fee_total() + ( $s['include_tax'] ? (float) $cart->get_fee_tax() : 0 );
		}
		return array(
			'value'    => round( $value * (float) $s['non_purchase_percent'] / 100, 6 ),
			'currency' => get_woocommerce_currency(),
			'coupon'   => implode( ',', $cart->get_applied_coupons() ),
			'items'    => array_slice( $items, 0, 200 ),
		);
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WC_Order $order Order.
	 * @return array<string,mixed> Paid totals and discounted item prices.
	 */
	public static function order( $order ): array {
		$s     = Settings::get( 'woo' );
		$items = array();
		$value = 0.0;
		foreach ( $order->get_items( 'line_item' ) as $line ) {
			if ( ! $line instanceof \WC_Order_Item_Product ) {
				continue; }
			$product = $line->get_product();
			$qty     = max( 1, (int) $line->get_quantity() );
			$total   = (float) $line->get_total() + ( $s['include_tax'] ? (float) $line->get_total_tax() : 0 );
			$items[] = $product ? self::item( $product, $qty, $total / $qty ) : array(
				'item_id'   => $s['id_prefix'] . ( $s['parent_ids'] ? $line->get_product_id() : ( $line->get_variation_id() ? $line->get_variation_id() : $line->get_product_id() ) ) . $s['id_suffix'],
				'item_name' => mb_substr( $line->get_name(), 0, 256 ),
				'quantity'  => $qty,
				'price'     => $total / $qty,
			);
			$value  += $total;
		}
		if ( $s['include_shipping'] ) {
			$value += (float) $order->get_shipping_total() + ( $s['include_tax'] ? (float) $order->get_shipping_tax() : 0 );
		}
		if ( $s['include_fees'] ) {
			foreach ( $order->get_items( 'fee' ) as $fee ) {
				if ( ! $fee instanceof \WC_Order_Item_Fee ) {
					continue; }
				$value += (float) $fee->get_total() + ( $s['include_tax'] ? (float) $fee->get_total_tax() : 0 );
			}
		}
		return array(
			'transaction_id' => 'woo_' . $order->get_id(),
			'value'          => round( $value, 6 ),
			'currency'       => $order->get_currency(),
			'tax'            => (float) $order->get_total_tax(),
			'shipping'       => (float) $order->get_shipping_total(),
			'coupon'         => implode( ',', $order->get_coupon_codes() ),
			'items'          => array_slice( $items, 0, 200 ),
		);
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $key Secret receipt key, never returned.
	 * @return \WC_Order|null Authorized paid order.
	 */
	public static function receipt( string $key ) {
		if ( '' === $key || strlen( $key ) > 100 ) {
			return null;
		}
		$id    = wc_get_order_id_by_order_key( $key );
		$order = $id ? wc_get_order( $id ) : false;
		if ( ! $order || ! $order->is_paid() || ! hash_equals( $order->get_order_key(), $key ) || ( $order->get_customer_id() && $order->get_customer_id() !== get_current_user_id() ) ) {
			return null;
		}
		return $order;
	}
}
