<?php
/**
 * Verified Meta server event envelope.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\Meta;

use PixelPair\Events\Event;
use PixelPair\Settings\Repository;

/** Build payloads from configured internal events and consented user data. */
final class Payload {
	/**
	 * Service operation.
	 *
	 * @param Event $event Validated internal event.
	 * @return array<string, mixed>
	 */
	public static function build( Event $event ): array {
		$settings = ( new Repository() )->get();
		$mapped   = ( new MetaPlatform() )->map_event( $event );
		if ( null === $mapped ) {
			return array();
		}
		$params = $mapped['params'];
		$source = $event->source_url;
		if ( $settings['meta_sensitive_data'] ) {
			$params = self::safe_params( $params );
			$source = trailingslashit( home_url() );
		}
		$out = array(
			'event_name'       => $mapped['name'],
			'event_time'       => $event->time,
			'event_id'         => $event->event_id,
			'event_source_url' => $source,
			'action_source'    => 'website',
			'user_data'        => self::user_data( $event->user_data ),
			'custom_data'      => (object) $params,
		);
		// VERIFY: Meta serverside/event.py exposes referrer_url at the event level.
		if ( ! $settings['meta_sensitive_data'] && is_string( $params['referrer_url'] ?? null ) && wp_http_validate_url( $params['referrer_url'] ) ) {
			$out['referrer_url'] = $params['referrer_url'];
		}
		if ( apply_filters( 'pixelpair_meta_ldu', $settings['meta_ldu'], $event ) ) {
			$out['data_processing_options']         = array( 'LDU' );
			$out['data_processing_options_country'] = 0;
			$out['data_processing_options_state']   = 0;
		}
		return $out;
	}
	/**
	 * Service operation.
	 *
	 * @param array<string, mixed> $params Event parameters.
	 * @return array<string, mixed>
	 */
	public static function safe_params( array $params ): array {
		return array_intersect_key( $params, array_flip( array( 'value', 'currency', 'num_items', 'percent_scrolled', 'seconds' ) ) );
	}
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $raw Public Event matching input, or already hashed collector arrays.
	 * @return array<string,mixed> Only Meta matching fields.
	 */
	private static function user_data( array $raw ): array {
		$data = \PixelPair\UserData\Normalizer::hashes( $raw );
		foreach ( array( 'em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'db', 'ge', 'external_id' ) as $key ) {
			if ( is_array( $raw[ $key ] ?? null ) ) {
				$hashes = array_values(
					array_filter(
						$raw[ $key ],
						static function ( $value ): bool {
							return is_string( $value ) && 1 === preg_match( '/\A[a-f0-9]{64}\z/', $value );
						}
					)
				);
				if ( $hashes ) {
					$data[ $key ] = array_slice( $hashes, 0, 5 );
				}
			}
		}
		foreach ( array( 'client_ip_address', 'client_user_agent', 'fbp', 'fbc' ) as $key ) {
			if ( is_string( $raw[ $key ] ?? null ) ) {
				$data[ $key ] = substr( $raw[ $key ], 0, 512 );
			}
		}
		return $data;
	}
}
