<?php
/**
 * Strip receipt credentials from explicit event URLs.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Support;

/** Receipt authorization stays in same-origin requests, never vendor metadata. */
final class Urls {

	/**
	 * Remove known private query keys and fragments.
	 *
	 * @param string $url Event URL.
	 * @return string Redacted URL.
	 */
	public static function public_url( string $url ): string {
		$url   = explode( '#', $url, 2 )[0];
		$query = wp_parse_url( $url, PHP_URL_QUERY );
		$args  = array();
		if ( is_string( $query ) ) {
			parse_str( $query, $args );
		}
		foreach ( array_keys( $args ) as $key ) {
			if ( in_array( strtolower( (string) $key ), array( 'key', 'payment_key', 'order', 'token', 'password', 'email', '_wpnonce', 'nonce', 'receipt' ), true ) ) {
				$url = remove_query_arg( $key, $url );
			}
		}
		return $url;
	}
}
