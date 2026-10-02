<?php
/**
 * Strict validation of a complete settings object.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Settings;

/** Reject invalid values before making any persistent change. */
final class Sanitizer {

	/**
	 * Validate raw values without numeric or boolean coercion.
	 *
	 * @param array<string, mixed> $settings Complete proposed settings.
	 * @param bool                 $require_registered_roles Reject unknown submitted roles; prune removed roles in stored settings.
	 * @return array<string, mixed>|\WP_Error
	 */
	public static function validate( array $settings, bool $require_registered_roles = true ) {
		$defaults = Defaults::all();
		foreach ( $settings as $key => $value ) {
			if ( ! array_key_exists( $key, $defaults ) ) {
				return self::error( $key );
			}
			if ( is_bool( $defaults[ $key ] ) && ! is_bool( $value ) ) {
				return self::error( $key );
			}
		}
		$settings = array_replace( $defaults, $settings );
		if ( ! is_string( $settings['tiktok_pixel_id'] ) || ( ! preg_match( '/\A[A-Z0-9]{20}\z/', $settings['tiktok_pixel_id'] ) && ( '' !== $settings['tiktok_pixel_id'] || $settings['tiktok_enabled'] ) ) ) {
			return self::error( 'tiktok_pixel_id' );
		}
		foreach ( array( 'woocommerce', 'edd' ) as $store ) {
			if ( ! \PixelPair\Commerce\Settings::valid( $settings[ $store ] ) ) {
				return self::error( $store );
			}
		}
		if ( ! EventSchema::valid( $settings ) ) {
			return self::error( 'automatic_events' );
		}
		$google = \PixelPair\Settings\GoogleSchema::validate( $settings );
		if ( is_wp_error( $google ) ) {
			return $google;
		}
		$settings = $google;
		if ( ! is_int( $settings['log_retention_days'] ) || $settings['log_retention_days'] < 1 || $settings['log_retention_days'] > 90 ) {
			return self::error( 'log_retention_days' );
		}
		if ( ! is_string( $settings['meta_pixel_id'] ) ) {
			return self::error( 'meta_pixel_id' );
		}
		$settings['meta_pixel_id'] = trim( $settings['meta_pixel_id'] );
		if ( ! preg_match( '/\A[0-9]{15,16}\z/', $settings['meta_pixel_id'] ) && ( '' !== $settings['meta_pixel_id'] || $settings['meta_enabled'] ) ) {
			return self::error( 'meta_pixel_id' );
		}
		foreach ( array( 'excluded_roles', 'excluded_ips' ) as $key ) {
			$values = $settings[ $key ];
			if ( ! is_array( $values ) || array_values( $values ) !== $values || count( $values ) > 100 ) {
				return self::error( $key );
			}
			foreach ( $values as $value ) {
				if ( ! is_string( $value ) ) {
					return self::error( $key );
				}
				if ( 'excluded_roles' === $key ? ( '' === $value || ( $require_registered_roles && null === get_role( $value ) ) ) : ! self::valid_ip_range( $value ) ) {
					return self::error( $key );
				}
			}
			$settings[ $key ] = array_values( array_unique( $values ) );
		}
		$settings['excluded_roles'] = array_values(
			array_filter(
				$settings['excluded_roles'],
				static function ( string $role ): bool {
					return null !== get_role( $role );
				}
			)
		);
		return $settings;
	}

	/**
	 * Accept an exact IPv4/IPv6 address or a CIDR range.
	 *
	 * @param string $range Input range.
	 * @return bool
	 */
	public static function valid_ip_range( string $range ): bool {
		$parts = explode( '/', $range );
		if ( count( $parts ) > 2 || false === filter_var( $parts[0], FILTER_VALIDATE_IP ) ) {
			return false;
		}
		if ( 1 === count( $parts ) ) {
			return true;
		}
		return (bool) preg_match( '/\A[0-9]{1,3}\z/', $parts[1] ) && (int) $parts[1] <= ( false === strpos( $parts[0], ':' ) ? 32 : 128 );
	}

	/**
	 * Return a translatable validation error with the invalid field.
	 *
	 * @param string $field Field key.
	 * @return \WP_Error
	 */
	private static function error( string $field ): \WP_Error {
		return new \WP_Error(
			'pixelpair_invalid_setting',
			__( 'Invalid setting. Check the highlighted field.', 'pixelpair' ),
			array(
				'status' => 400,
				'field'  => $field,
			)
		);
	}
}
