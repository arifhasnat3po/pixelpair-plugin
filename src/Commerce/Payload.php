<?php
/**
 * Platform commerce payloads from authoritative store snapshots.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Commerce;

/**
 * Keep item arrays separate from untrusted scalar custom parameters.
 */
final class Payload {

	/**
	 * Provide validated commerce data.
	 *
	 * @param array<string,mixed> $snapshot Store data.
	 * @param string              $platform Destination.
	 * @return array<string,mixed> Bounded payload.
	 */
	public static function map( array $snapshot, string $platform ): array {
		$out = array();
		foreach ( array( 'value', 'tax', 'shipping' ) as $key ) {
			if ( isset( $snapshot[ $key ] ) && is_numeric( $snapshot[ $key ] ) && is_finite( (float) $snapshot[ $key ] ) ) {
				$out[ $key ] = round( (float) $snapshot[ $key ], 6 );
			}
		}
		foreach ( array( 'currency', 'transaction_id', 'coupon', 'payment_type', 'shipping_tier', 'item_list_id', 'item_list_name' ) as $key ) {
			if ( isset( $snapshot[ $key ] ) && is_scalar( $snapshot[ $key ] ) ) {
				$out[ $key ] = mb_substr( (string) $snapshot[ $key ], 0, 100 );
			}
		}
		$items = array();
		foreach ( array_slice( (array) ( $snapshot['items'] ?? array() ), 0, 200 ) as $item ) {
			if ( ! is_array( $item ) || ! isset( $item['item_id'] ) ) {
				continue;
			}
			$safe = array();
			foreach ( array( 'item_id', 'item_name', 'item_brand', 'item_category', 'item_category2', 'item_category3', 'item_category4', 'item_category5', 'item_variant', 'coupon' ) as $key ) {
				if ( isset( $item[ $key ] ) && is_scalar( $item[ $key ] ) ) {
					$safe[ $key ] = mb_substr( (string) $item[ $key ], 0, 100 );
				}
			}
			foreach ( array( 'price', 'quantity', 'discount', 'index' ) as $key ) {
				if ( isset( $item[ $key ] ) && is_numeric( $item[ $key ] ) && is_finite( (float) $item[ $key ] ) ) {
					$safe[ $key ] = 'quantity' === $key ? max( 1, min( 100000, (int) $item[ $key ] ) ) : round( (float) $item[ $key ], 6 );
				}
			}
			$items[] = $safe;
		}
		if ( in_array( $platform, array( 'ga4', 'gtm' ), true ) ) {
			$out['items'] = $items;
			return $out;
		}
		$out                 = array_intersect_key( $out, array_flip( array( 'value', 'currency' ) ) );
		$out['content_type'] = 'product';
		$out['contents']     = array();
		$out['content_ids']  = array();
		$out['num_items']    = 0;
		foreach ( $items as $item ) {
			$quantity             = $item['quantity'] ?? 1;
			$out['content_ids'][] = $item['item_id'];
			$out['contents'][]    = array(
				'id'         => $item['item_id'],
				'quantity'   => $quantity,
				'item_price' => $item['price'] ?? 0,
			);
			$out['num_items']    += $quantity;
		}
		if ( 'tiktok' === $platform ) {
			$out['contents'] = array_map(
				static function ( array $item ): array {
					return array(
						'content_id'       => $item['item_id'],
						'content_name'     => $item['item_name'] ?? '',
						'content_category' => $item['item_category'] ?? '',
						'brand'            => $item['item_brand'] ?? '',
						'price'            => $item['price'] ?? 0,
						'quantity'         => $item['quantity'] ?? 1,
					);
				},
				$items
			);
			unset( $out['content_ids'] );
		}
		return $out;
	}
}
