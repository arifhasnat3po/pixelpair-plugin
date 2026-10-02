<?php
/**
 * Google settings validation.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Settings;

/** Keep URLs, identifiers and global variable names bounded. */
final class GoogleSchema {
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $s Proposed settings.
	 * @return array<string,mixed>|\WP_Error
	 */
	public static function validate( array $s ) {
		$field = '';
		if ( ! is_array( $s['ga4_ids'] ) || array_values( $s['ga4_ids'] ) !== $s['ga4_ids'] || count( $s['ga4_ids'] ) > 10 || ( $s['ga4_enabled'] && ! $s['ga4_ids'] ) ) {
			$field = 'ga4_ids';
		} else {
			foreach ( $s['ga4_ids'] as $id ) {
				if ( ! is_string( $id ) || ! preg_match( '/\AG-[A-Z0-9]{4,20}\z/', $id ) ) {
					$field = 'ga4_ids';
				}
			}
			if ( '' === $field ) {
				$s['ga4_ids'] = array_values( array_unique( $s['ga4_ids'] ) );
			}
		}
		if ( ! is_string( $s['gtm_id'] ) || ( ( '' !== $s['gtm_id'] || ( $s['gtm_enabled'] && ! $s['gtm_data_layer_only'] ) ) && ! preg_match( '/\AGTM-[A-Z0-9]{4,20}\z/', $s['gtm_id'] ) ) ) {
			$field = 'gtm_id';
		}
		foreach ( array( 'google_data_layer', 'gtm_data_layer' ) as $key ) {
			if ( ! is_string( $s[ $key ] ) || ! preg_match( '/\A[A-Za-z_$][A-Za-z0-9_$]{0,63}\z/', $s[ $key ] ) || in_array( $s[ $key ], array( '__proto__', 'prototype', 'constructor', 'window', 'document', 'location', 'navigator', 'history', 'top', 'self', 'parent', 'frames', 'name', 'onload', 'fbq', 'gtag', 'pixelpairConfig', 'pixelpairRuntime' ), true ) ) {
				$field = $key;
			}
		}
		foreach ( array( 'ga4_server_url', 'gtm_server_url' ) as $key ) {
			if ( ! is_string( $s[ $key ] ) ) {
				$field = $key;
				continue;
			}
			if ( '' === $s[ $key ] ) {
				continue;
			}
			$url = wp_parse_url( $s[ $key ] );
			if ( strlen( $s[ $key ] ) > 2048 || ! is_array( $url ) || ( $url['scheme'] ?? '' ) !== 'https' || empty( $url['host'] ) || isset( $url['user'] ) || isset( $url['pass'] ) || isset( $url['query'] ) || isset( $url['fragment'] ) || false === filter_var( $s[ $key ], FILTER_VALIDATE_URL ) ) {
				$field = $key;
			} else {
				$s[ $key ] = rtrim( $s[ $key ], '/' );
			}
		}
		foreach ( array( 'borlabs_marketing', 'borlabs_statistics', 'rcb_marketing', 'rcb_statistics' ) as $key ) {
			if ( ! is_string( $s[ $key ] ) || ! preg_match( '/\A[a-zA-Z0-9_-]{0,100}\z/', $s[ $key ] ) ) {
				$field = $key;
			}
		}
		if ( ! is_int( $s['google_wait_for_update'] ) || $s['google_wait_for_update'] < 0 || $s['google_wait_for_update'] > 2000 ) {
			$field = 'google_wait_for_update';
		}
		return '' === $field ? $s : new \WP_Error(
			'pixelpair_invalid_setting',
			__( 'Invalid Google or consent setting.', 'pixelpair' ),
			array(
				'status' => 400,
				'field'  => $field,
			)
		);
	}
}
