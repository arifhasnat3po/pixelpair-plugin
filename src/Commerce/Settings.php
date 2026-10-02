<?php
/**
 * Store configuration and verified event mappings.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Commerce;

/**
 * Shared settings for both commerce providers.
 */
final class Settings {

	/**
	 * Provide validated commerce data.
	 *
	 * @return array<string,mixed> Default configuration.
	 */
	public static function defaults(): array {
		return array(
			'enabled'              => false,
			'content_id'           => 'id',
			'id_prefix'            => '',
			'id_suffix'            => '',
			'parent_ids'           => false,
			'include_tax'          => true,
			'include_shipping'     => true,
			'include_fees'         => true,
			'non_purchase_percent' => 100,
			'list_limit'           => 20,
			'add_to_cart_source'   => 'hook',
			'attribution'          => true,
			'hide_attribution'     => false,
			'renewals'             => false,
			'safety_net'           => true,
			'events'               => array(
				'view_item'         => true,
				'view_item_list'    => true,
				'add_to_cart'       => true,
				'view_cart'         => true,
				'begin_checkout'    => true,
				'add_payment_info'  => true,
				'add_shipping_info' => true,
				'purchase'          => true,
				'refund'            => false,
			),
		);
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param mixed $value Proposed configuration.
	 * @return bool Valid complete settings.
	 */
	public static function valid( $value ): bool {
		$defaults = self::defaults();
		if ( ! is_array( $value ) || array_diff_key( $value, $defaults ) || array_diff_key( $defaults, $value ) ) {
			return false;
		}
		foreach ( $defaults as $key => $default ) {
			if ( is_bool( $default ) && ! is_bool( $value[ $key ] ) ) {
				return false;
			}
		}
		foreach ( array( 'id_prefix', 'id_suffix' ) as $key ) {
			if ( ! is_string( $value[ $key ] ) || ! preg_match( '/\A[A-Za-z0-9_-]{0,64}\z/', $value[ $key ] ) ) {
				return false;
			}
		}
		if ( ! in_array( $value['content_id'], array( 'id', 'sku' ), true ) || ! in_array( $value['add_to_cart_source'], array( 'hook', 'button' ), true ) || ! is_int( $value['list_limit'] ) || $value['list_limit'] < 0 || $value['list_limit'] > 200 || ( ! is_int( $value['non_purchase_percent'] ) && ! is_float( $value['non_purchase_percent'] ) ) || ! is_finite( (float) $value['non_purchase_percent'] ) || $value['non_purchase_percent'] < 0 || $value['non_purchase_percent'] > 10000 ) {
			return false;
		}
		if ( ! is_array( $value['events'] ) || array_diff_key( $value['events'], $defaults['events'] ) || array_diff_key( $defaults['events'], $value['events'] ) ) {
			return false;
		}
		foreach ( $value['events'] as $enabled ) {
			if ( ! is_bool( $enabled ) ) {
				return false;
			}
		}
		// Reserved until a supported consented refund destination is implemented.
		return false === $value['events']['refund'];
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $provider woo or edd.
	 * @return array<string,mixed> Stored settings.
	 */
	public static function get( string $provider ): array {
		return ( new \PixelPair\Settings\Repository() )->get()[ 'woo' === $provider ? 'woocommerce' : 'edd' ];
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $name Internal event.
	 * @param string $platform Destination.
	 * @return array<string,mixed>|null Mapping.
	 */
	public static function mapping( string $name, string $platform ): ?array {
		if ( ! preg_match( '/\A(woo|edd)_(.+)\z/', $name, $match ) ) {
			return null;
		}
		$s   = self::get( $match[1] );
		$key = $match[2];
		if ( ! $s['enabled'] || empty( $s['events'][ $key ] ) ) {
			return null;
		}
		$meta   = array(
			'view_item'        => 'ViewContent',
			'add_to_cart'      => 'AddToCart',
			'view_cart'        => 'ViewCart',
			'begin_checkout'   => 'InitiateCheckout',
			'add_payment_info' => 'AddPaymentInfo',
			'purchase'         => 'Purchase',
		);
		$tiktok = array(
			'view_item'        => 'ViewContent',
			'add_to_cart'      => 'AddToCart',
			'begin_checkout'   => 'InitiateCheckout',
			'add_payment_info' => 'AddPaymentInfo',
			'purchase'         => 'Purchase',
		);
		$mapped = 'meta' === $platform ? $meta[ $key ] ?? null : ( 'tiktok' === $platform ? $tiktok[ $key ] ?? null : ( in_array( $platform, array( 'ga4', 'gtm' ), true ) ? $key : null ) );
		return $mapped ? array(
			'enabled' => true,
			'name'    => $mapped,
			'params'  => array(),
			'server'  => in_array( $platform, array( 'meta', 'tiktok' ), true ),
		) : null;
	}
}
