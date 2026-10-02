<?php
/**
 * Consented TikTok matching identifiers.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\UserData;

/** Read SDK identifiers without fabricating click attribution. */
final class TikTokCookies {
	/**
	 * Read consented identifiers.
	 *
	 * @param string $source Verified source URL.
	 * @return array<string,string>
	 */
	public static function values( string $source ): array {
		\PixelPair\Settings\Migrations::cookies();
		$out    = array();
		$params = array();
		parse_str( (string) wp_parse_url( $source, PHP_URL_QUERY ), $params );
		foreach ( array(
			'_ttp'              => 'ttp',
			'ttclid'            => 'ttclid',
			'pixelpair_visitor' => 'external_id',
		) as $cookie => $field ) {
		 // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Exact bounded protocol pattern below.
			$value = isset( $_COOKIE[ $cookie ] ) && is_string( $_COOKIE[ $cookie ] ) ? wp_unslash( $_COOKIE[ $cookie ] ) : '';
			if ( 'ttclid' === $cookie && isset( $params['ttclid'] ) && is_string( $params['ttclid'] ) ) {
				$value = $params['ttclid'];}
			if ( 'external_id' === $field && ! preg_match( '/\A[a-f0-9]{32}\z/', $value ) ) {
				$value = bin2hex( random_bytes( 16 ) );}
			if ( ! preg_match( '/\A[A-Za-z0-9_.-]{1,512}\z/', $value ) ) {
				continue;}
			$out[ $field ] = $value;
			if ( '_ttp' !== $cookie && ! headers_sent() ) {
				setcookie(
					$cookie,
					$value,
					array(
						'expires'  => time() + 30 * DAY_IN_SECONDS,
						'path'     => '/',
						'secure'   => is_ssl(),
						'httponly' => 'pixelpair_visitor' === $cookie,
						'samesite' => 'Lax',
					)
				);}
		}
		return $out;
	}
}
