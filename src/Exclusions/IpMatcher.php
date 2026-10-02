<?php
/**
 * Binary IPv4 and IPv6 address matching.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Exclusions;

use PixelPair\Settings\Sanitizer;

/** Compare exact addresses and CIDR prefixes without integer overflow. */
final class IpMatcher {
	/**
	 * Match an address to a validated exclusion entry.
	 *
	 * @param string $ip Connection address.
	 * @param string $entry Exact address or range.
	 * @return bool
	 */
	public static function matches( string $ip, string $entry ): bool {
		if ( ! Sanitizer::valid_ip_range( $entry ) || false === filter_var( $ip, FILTER_VALIDATE_IP ) ) {
			return false;
		}
		$parts   = explode( '/', $entry );
		$address = inet_pton( $ip );
		$network = inet_pton( $parts[0] );
		if ( false === $address || false === $network || strlen( $address ) !== strlen( $network ) ) {
			return false;
		}
		$bits  = isset( $parts[1] ) ? (int) $parts[1] : strlen( $network ) * 8;
		$bytes = intdiv( $bits, 8 );
		if ( substr( $address, 0, $bytes ) !== substr( $network, 0, $bytes ) ) {
			return false;
		}
		$remainder = $bits % 8;
		return 0 === $remainder || ( ord( $address[ $bytes ] ) & ( 255 << ( 8 - $remainder ) ) ) === ( ord( $network[ $bytes ] ) & ( 255 << ( 8 - $remainder ) ) );
	}
}
