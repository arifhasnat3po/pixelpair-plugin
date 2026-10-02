<?php
/**
 * Event controls with bounded payloads.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Settings;

/** Validate automatic controls and shared per-platform payloads. */
final class EventSchema {
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $s Settings.
	 * @return bool
	 */
	public static function valid( array $s ): bool {
		$defs = \PixelPair\Events\Automatic\Registry::defaults();
		if ( ! is_array( $s['automatic_events'] ) || array_diff_key( $s['automatic_events'], $defs ) || array_diff_key( $defs, $s['automatic_events'] ) ) {
			return false;
		}
		foreach ( $s['automatic_events'] as $key => $value ) {
			if ( ! is_array( $value ) || array_diff( array_keys( $value ), array( 'enabled', 'platforms' ) ) || ! isset( $value['enabled'], $value['platforms'] ) || ! is_bool( $value['enabled'] ) || ! self::platforms( $value['platforms'] ) ) {
				return false;
			}
			if ( 'page_view' === $key && ( ! $value['enabled'] || ! $value['platforms']['meta']['enabled'] || ! $value['platforms']['ga4']['enabled'] || ! $value['platforms']['gtm']['enabled'] ) ) {
				return false;
			}
		}
		foreach ( array(
			'scroll_thresholds' => 100,
			'time_thresholds'   => 3600,
		) as $key => $max ) {
			if ( ! is_array( $s[ $key ] ) || array_values( $s[ $key ] ) !== $s[ $key ] || count( $s[ $key ] ) > 20 ) {
				return false;
			}
			foreach ( $s[ $key ] as $n ) {
				if ( ! is_int( $n ) || $n < 1 || $n > $max ) {
					return false;
				}
			}
		}
		if ( ! is_array( $s['download_extensions'] ) || count( $s['download_extensions'] ) > 50 ) {
			return false;
		}
		foreach ( $s['download_extensions'] as $extension ) {
			if ( ! is_string( $extension ) || ! preg_match( '/\A[a-z0-9]{1,10}\z/', $extension ) ) {
				return false;
			}
		}
		if ( ! is_array( $s['context_parameters'] ) ) {
			return false;
		}
		foreach ( $s['context_parameters'] as $field ) {
			if ( ! is_string( $field ) ) {
				return false;
			}
		}
		return ! array_diff( $s['context_parameters'], array( 'page_title', 'post_type', 'post_id', 'categories', 'tags', 'landing_page', 'traffic_source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content' ) );
	}
	/**
	 * Service operation.
	 *
	 * @param mixed $value Platform controls.
	 * @return bool
	 */
	public static function platforms( $value ): bool {
		if ( ! is_array( $value ) || ! in_array( count( $value ), array( 3, 4 ), true ) || array_diff( array_keys( $value ), array( 'meta', 'ga4', 'gtm', 'tiktok' ) ) ) {
			return false;
		}
		foreach ( $value as $key => $payload ) {
			if ( ! is_array( $payload ) || array_diff( array_keys( $payload ), array( 'enabled', 'name', 'params', 'server' ) ) || ! isset( $payload['enabled'], $payload['name'], $payload['params'], $payload['server'] ) || ! is_bool( $payload['enabled'] ) || ! is_bool( $payload['server'] ) || ( ! in_array( $key, array( 'meta', 'tiktok' ), true ) && $payload['server'] ) || ! is_string( $payload['name'] ) || ! preg_match( '/\A[A-Za-z][A-Za-z0-9_]{0,39}\z/', $payload['name'] ) || ! self::params( $payload['params'] ) ) {
				return false;
			}
		}return true;
	}
	/**
	 * Service operation.
	 *
	 * @param mixed $value Flat scalar parameter map.
	 * @return bool
	 */
	public static function params( $value ): bool {
		if ( ! is_array( $value ) || count( $value ) > 25 ) {
			return false;
		}
		foreach ( $value as $key => $v ) {
			if ( is_float( $v ) && ! is_finite( $v ) ) {
				return false;
			}
			if ( ! is_string( $key ) || ! preg_match( '/\A[A-Za-z][A-Za-z0-9_]{0,39}\z/', $key ) || in_array( $key, array( 'constructor', 'prototype', '__proto__', 'event_id', 'send_to', 'user_data', 'email', 'phone', 'em', 'ph' ), true ) || ! is_scalar( $v ) || ( is_string( $v ) && strlen( $v ) > 512 ) ) {
				return false;
			}
			if ( is_string( $v ) && preg_match_all( '/\{([^{}]+)\}/', $v, $tokens ) ) {
				foreach ( $tokens[1] as $token ) {
					if ( ! in_array( $token, array( 'post_title', 'post_id', 'post_type', 'page_url', 'woo_cart_total' ), true ) && ! preg_match( '/\Aurl_param:[a-zA-Z0-9_-]{1,64}\z/', $token ) ) {
						return false;
					}
				}
			}
			if ( is_string( $v ) && preg_match( '/[{}]/', (string) preg_replace( '/\{[^{}]+\}/', '', $v ) ) ) {
				return false;
			}
		}return true;
	}
}
