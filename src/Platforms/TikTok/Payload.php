<?php
/**
 * Verified TikTok event payload.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Platforms\TikTok;

use PixelPair\Events\Event;
/**
 * Explicit field mapping prevents raw identity from entering vendor payloads.
 */
final class Payload {

	/**
	 * Apply the validated configuration.
	 *
	 * @param Event $event Consented event.
	 * @return array<string,mixed>
	 */
	public static function build( Event $event ): array {
		$mapped = ( new TikTokPlatform() )->map_event( $event );
		if ( ! $mapped ) {
			return array();
		}
		$hashes = \PixelPair\UserData\Normalizer::hashes( $event->user_data );
		$user   = array();
		foreach ( array(
			'em'          => 'email',
			'ph'          => 'phone',
			'external_id' => 'external_id',
		) as $from => $to ) {
			$value = $event->user_data[ $from ][0] ?? null;
			if ( ! is_string( $value ) || ! preg_match( '/\A[a-f0-9]{64}\z/', $value ) ) {
				$value = $hashes[ $from ][0] ?? null;
			}
			if ( is_string( $value ) ) {
				$user[ $to ] = $value;
			}
		}
		foreach ( array(
			'ttp'               => 'ttp',
			'ttclid'            => 'ttclid',
			'client_ip_address' => 'ip',
			'client_user_agent' => 'user_agent',
		) as $from => $to ) {
			if ( is_string( $event->user_data[ $from ] ?? null ) ) {
				$user[ $to ] = substr( $event->user_data[ $from ], 0, 512 );
			}
		}
		return array(
			'event'      => $mapped['name'],
			'event_id'   => $event->event_id,
			'event_time' => $event->time,
			'page'       => array( 'url' => $event->source_url ),
			'user'       => $user,
			'properties' => (object) $mapped['params'],
		);
	}
}
