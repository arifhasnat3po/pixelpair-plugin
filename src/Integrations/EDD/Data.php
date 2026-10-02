<?php
/**
 * EDD 3.x authoritative data.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Integrations\EDD;

use PixelPair\Commerce\Settings;
/**
 * Adapt EDD public APIs to the shared commerce contract.
 */
final class Data {

	/**
	 * Apply the validated configuration.
	 *
	 * @param int      $id Download ID.
	 * @param int|null $price_id Variable price.
	 * @return string
	 */
	public static function content_id( int $id, ?int $price_id = null ): string {
		$s        = Settings::get( 'edd' );
		$download = new \EDD_Download( $id );
		$sku      = $download->get_sku();
		$value    = 'sku' === $s['content_id'] && $sku ? $sku : (string) $id;
		if ( null !== $price_id && ! $s['parent_ids'] ) {
			$value .= '_' . $price_id;
		}
		return mb_substr( (string) apply_filters( 'pixelpair_content_id', $s['id_prefix'] . $value . $s['id_suffix'], $download, 'edd' ), 0, 100 );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int      $id Download.
	 * @param int      $quantity Units.
	 * @param int|null $price_id Price option.
	 * @return array<string,mixed>|null
	 */
	public static function product( int $id, int $quantity = 1, ?int $price_id = null ): ?array {
		$download = new \EDD_Download( $id );
		if ( ! $download->ID || 'publish' !== get_post_status( $id ) ) {
			return null;
		}
		if ( $download->has_variable_prices() ) {
			$price_id = null === $price_id ? (int) $download->get_default_price_id() : $price_id;
			if ( ! isset( $download->get_prices()[ $price_id ] ) ) {
				return null;
			}
		} else {
			$price_id = null;
		}
		$s        = Settings::get( 'edd' );
		$quantity = max( 1, min( 100000, $quantity ) );
		$options  = null === $price_id ? array() : array( 'price_id' => $price_id );
		$price    = (float) edd_get_cart_item_price( $id, $options, true );
		if ( $s['include_tax'] ) {
			$price += (float) edd_get_cart_item_tax( $id, $options, $price );
		}
		$price *= $s['non_purchase_percent'] / 100;
		return array(
			'currency' => edd_get_currency(),
			'value'    => round( $price * $quantity, 6 ),
			'items'    => array( self::item( $id, $quantity, $price, $price_id ) ),
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int      $id Download.
	 * @param int      $quantity Units.
	 * @param float    $price Unit value.
	 * @param int|null $price_id Option.
	 * @return array<string,mixed>
	 */
	private static function item( int $id, int $quantity, float $price, ?int $price_id ): array {
		$item = array(
			'item_id'   => self::content_id( $id, $price_id ),
			'item_name' => wp_strip_all_tags( get_the_title( $id ) ),
			'quantity'  => $quantity,
			'price'     => round( $price, 6 ),
		);
		if ( null !== $price_id ) {
			$prices               = ( new \EDD_Download( $id ) )->get_prices();
			$item['item_variant'] = wp_strip_all_tags( (string) ( $prices[ $price_id ]['name'] ?? $price_id ) );
		}
		$terms = get_the_terms( $id, 'download_category' );
		if ( is_array( $terms ) && $terms ) {
			$item['item_category'] = $terms[0]->name;
		}
		return $item;
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @return array<string,mixed> Current session cart.
	 */
	public static function cart(): array {
		$s      = Settings::get( 'edd' );
		$items  = array();
		$factor = $s['non_purchase_percent'] / 100;
		foreach ( array_slice( (array) edd_get_cart_content_details(), 0, 200 ) as $row ) {
			$q                = max( 1, (int) $row['quantity'] );
			$total            = (float) $row['subtotal'] - (float) $row['discount'] + ( $s['include_tax'] ? (float) $row['tax'] : 0 );
			$price_id         = $row['item_number']['options']['price_id'] ?? null;
			$item             = self::item( (int) $row['id'], $q, $total / $q * $factor, null === $price_id ? null : (int) $price_id );
			$item['discount'] = (float) $row['discount'] / $q;
			$items[]          = $item;
		}
		$tax   = (float) edd_get_cart_tax();
		$fees  = (float) edd_get_cart_fee_total();
		$total = (float) edd_get_cart_total() - ( $s['include_tax'] ? 0 : $tax ) - ( $s['include_fees'] ? 0 : $fees );
		return array(
			'currency' => edd_get_currency(),
			'value'    => round( max( 0, $total ) * $factor, 6 ),
			'tax'      => $tax,
			'coupon'   => implode( ',', (array) EDD()->cart->get_discounts() ),
			'items'    => $items,
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \EDD\Orders\Order $order Verified order.
	 * @return array<string,mixed>
	 */
	public static function order( $order ): array {
		$s     = Settings::get( 'edd' );
		$items = array();
		foreach ( array_slice( $order->get_items(), 0, 200 ) as $row ) {
			$q                 = max( 1, (int) $row->quantity );
			$total             = (float) $row->subtotal - (float) $row->discount + ( $s['include_tax'] ? (float) $row->tax : 0 );
			$item              = self::item( (int) $row->product_id, $q, $total / $q, null === $row->price_id ? null : (int) $row->price_id );
			$item['item_name'] = wp_strip_all_tags( $row->product_name );
			$item['discount']  = (float) $row->discount / $q;
			$items[]           = $item;
		}
		$fees = 0;
		foreach ( $order->get_fees() as $fee ) {
			$fees += (float) $fee->subtotal;
		}
		$coupons = array();
		foreach ( $order->get_discounts() as $discount ) {
			$coupons[] = $discount->description;
		}
		return array(
			'transaction_id' => 'edd_' . $order->id,
			'currency'       => $order->currency,
			'value'          => round( max( 0, (float) $order->total - ( $s['include_tax'] ? 0 : (float) $order->tax ) - ( $s['include_fees'] ? 0 : $fees ) ), 6 ),
			'tax'            => (float) $order->tax,
			'coupon'         => implode( ',', $coupons ),
			'items'          => $items,
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param array<string,mixed> $query URL arguments.
	 * @return \EDD\Orders\Order|null
	 */
	public static function receipt( array $query ) {
		$order = null;
		if ( isset( $query['payment_key'] ) && is_string( $query['payment_key'] ) && strlen( $query['payment_key'] ) <= 128 ) {
			$order = edd_get_order_by( 'payment_key', $query['payment_key'] );
		} elseif ( isset( $query['order'], $query['id'] ) && is_scalar( $query['id'] ) && is_string( $query['order'] ) && strlen( $query['order'] ) <= 128 ) {
			$candidate = edd_get_order( absint( $query['id'] ) );
			if ( $candidate && method_exists( $candidate, 'is_receipt_hash_valid' ) && $candidate->is_receipt_hash_valid( $query['order'] ) ) {
				$order = $candidate;
			}
		} else {
			$session = edd_get_purchase_session();
			if ( is_array( $session ) && is_string( $session['purchase_key'] ?? null ) ) {
				$order = edd_get_order_by( 'payment_key', $session['purchase_key'] );
			}
		}
		return $order && Integration::paid( $order ) && edd_can_view_receipt( $order ) ? $order : null;
	}
}
