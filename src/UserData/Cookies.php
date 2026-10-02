<?php
/**
 * Consent-gated first-party identifiers, called only by the event endpoint.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\UserData;

/** Supply valid IDs without fabricating click attribution. */
final class Cookies {
	/**
	 * Service operation.
	 *
	 * @param string $source Validated same-origin page URL.
	 * @return array<string, string>
	 */
	public static function values( string $source ): array {
		\PixelPair\Settings\Migrations::cookies();
		$milliseconds = (string) (int) floor( microtime( true ) * 1000 );
		$fbp          = self::read( '_fbp' );
		if ( ! preg_match( '/\Afb\.1\.[0-9]{13}\.[0-9]{1,30}\z/', $fbp ) ) {
			$fbp = 'fb.1.' . $milliseconds . '.' . random_int( 100000000, 2147483647 );
			self::write( '_fbp', $fbp, false );
		}
		$visitor = self::read( 'pixelpair_visitor' );
		if ( ! preg_match( '/\A[a-f0-9]{32}\z/', $visitor ) ) {
			$visitor = bin2hex( random_bytes( 16 ) );
			self::write( 'pixelpair_visitor', $visitor, true );
		}
		$out   = array(
			'fbp'         => $fbp,
			'external_id' => $visitor,
		);
		$fbc   = self::read( '_fbc' );
		$query = wp_parse_url( $source, PHP_URL_QUERY );
		parse_str( is_string( $query ) ? $query : '', $params );
		if ( isset( $params['fbclid'] ) && is_string( $params['fbclid'] ) && preg_match( '/\A[A-Za-z0-9_-]{1,500}\z/', $params['fbclid'] ) ) {
			$click = $params['fbclid'];
			if ( ! preg_match( '/\Afb\.1\.[0-9]{13}\.' . preg_quote( $click, '/' ) . '\z/', $fbc ) ) {
				$fbc = 'fb.1.' . $milliseconds . '.' . $click;
				self::write( '_fbc', $fbc, false );
			}
		}
		if ( preg_match( '/\Afb\.1\.[0-9]{13}\.[A-Za-z0-9_-]{1,500}\z/', $fbc ) ) {
			$out['fbc'] = $fbc;
		}
		return $out;
	}
	/**
	 * Service operation.
	 *
	 * @param string $name Cookie name.
	 * @return string
	 */
	private static function read( string $name ): string {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Strict protocol patterns validate every use above.
		return isset( $_COOKIE[ $name ] ) && is_string( $_COOKIE[ $name ] ) ? wp_unslash( $_COOKIE[ $name ] ) : '';
	}
	/**
	 * Service operation.
	 *
	 * @param string $name Cookie name.
	 * @param string $value Validated value.
	 * @param bool   $http_only Restrict browser access.
	 */
	private static function write( string $name, string $value, bool $http_only ): void {
		if ( ! headers_sent() ) {
			setcookie(
				$name,
				$value,
				array(
					'expires'  => time() + 90 * DAY_IN_SECONDS,
					'path'     => '/',
					'secure'   => is_ssl(),
					'httponly' => $http_only,
					'samesite' => 'Lax',
				)
			);
		}
		$_COOKIE[ $name ] = $value;
	}
}
