<?php
/**
 * Final scalar payload limits shared with the browser dispatcher.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

/** Bound context and token expansion after composing all configured fields. */
final class Params {
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $input Composed parameters.
	 * @return array<string,mixed>
	 */
	public static function bound( array $input ): array {
		$out = array();
		foreach ( array_slice( $input, 0, 48, true ) as $key => $raw ) {
			if ( ! is_scalar( $raw ) || ( is_float( $raw ) && ! is_finite( $raw ) ) ) {
				continue;
			}
			if ( is_string( $raw ) && preg_match( '~^https?://~i', $raw ) ) {
				$raw = \PixelPair\Support\Urls::public_url( $raw );}
			$value = is_string( $raw ) ? mb_substr( $raw, 0, 256 ) : $raw;
			$bytes = strlen( (string) wp_json_encode( array_merge( $out, array( $key => $value ) ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
			while ( $bytes > 11000 ) {
				if ( ! is_string( $value ) || '' === $value ) {
					return $out;
				}
				$value = mb_substr( $value, 0, (int) floor( mb_strlen( $value ) / 2 ) );
				$bytes = strlen( (string) wp_json_encode( array_merge( $out, array( $key => $value ) ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
			}
			$out[ $key ] = $value;
		}
		return $out;
	}
}
