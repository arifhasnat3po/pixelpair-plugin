<?php
/**
 * Request data with explicit trust boundaries.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Support;

/** Read connection information without trusting proxy headers. */
final class Request {
	/** Return a validated direct connection address. */
	public static function client_ip(): string {
		$ip = self::server( 'REMOTE_ADDR' );
		if ( ( new \PixelPair\Settings\Repository() )->get()['trust_proxy'] && '' !== self::server( 'HTTP_X_FORWARDED_FOR' ) ) {
			$ip = trim( explode( ',', self::server( 'HTTP_X_FORWARDED_FOR' ) )[0] );
		}
		return false !== filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '';
	}
	/**
	 * Read a scalar server value.
	 *
	 * @param string $key Server field.
	 * @return string
	 */
	public static function server( string $key ): string {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Consumers validate the raw protocol value; never output it directly.
		return isset( $_SERVER[ $key ] ) && is_string( $_SERVER[ $key ] ) ? wp_unslash( $_SERVER[ $key ] ) : '';
	}
	/**
	 * Compare normalized HTTP origins, including ports, rejecting credentials.
	 *
	 * @param string $url Candidate URL.
	 * @param string $base Site URL.
	 * @return bool
	 */
	public static function same_origin( string $url, string $base ): bool {
		$a = wp_parse_url( $url );
		$b = wp_parse_url( $base );
		if ( ! is_array( $a ) || ! is_array( $b ) || isset( $a['user'] ) || isset( $a['pass'] ) ) {
			return false;
		}
		foreach ( array( $a, $b ) as $parts ) {
			if ( empty( $parts['host'] ) || empty( $parts['scheme'] ) || ! in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true ) ) {
				return false;
			}
		}
		return strtolower( $a['scheme'] ) === strtolower( $b['scheme'] ) && strtolower( $a['host'] ) === strtolower( $b['host'] ) && ( $a['port'] ?? ( 'https' === strtolower( $a['scheme'] ) ? 443 : 80 ) ) === ( $b['port'] ?? ( 'https' === strtolower( $b['scheme'] ) ? 443 : 80 ) );
	}
}
