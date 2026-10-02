<?php
/**
 * Collect matching data only on a permitted uncached event request.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\UserData;

use PixelPair\Settings\Repository;
use PixelPair\Support\Request;

/** Hash server-derived matching fields before queueing. */
final class Collector {
	/** Apply the current matching policy to retained collector data.
	 *
	 * @param array<string,mixed> $data Captured data.
	 * @param string              $platform Destination.
	 * @return array<string,mixed>
	 */
	public static function permitted( array $data, string $platform ): array {
		return ( new Repository() )->get()[ $platform . '_advanced_matching' ] ? $data : array_intersect_key( $data, array_flip( array( 'external_id', 'fbp', 'fbc', 'ttp', 'ttclid', 'client_ip_address', 'client_user_agent' ) ) );
	}
	/**
	 * Service operation.
	 *
	 * @param string $source Same-origin source.
	 * @param string $platform Matching policy and cookie namespace.
	 * @return array<string, mixed>
	 */
	public function collect( string $source, string $platform = 'meta' ): array {
		$ids  = 'tiktok' === $platform ? TikTokCookies::values( $source ) : Cookies::values( $source );
		$user = wp_get_current_user();
		$raw  = array( 'external_id' => $user->exists() ? (string) $user->ID : $ids['external_id'] );
		if ( ( new Repository() )->get()[ $platform . '_advanced_matching' ] ) {
			if ( $user->exists() ) {
				$raw += array(
					'em' => $user->user_email,
					'fn' => $user->first_name,
					'ln' => $user->last_name,
				);
			}
			$raw = (array) apply_filters( 'pixelpair_user_data', $raw );
		}
		$data = Normalizer::hashes( $raw );
		unset( $ids['external_id'] );
		return array_merge(
			$data,
			$ids,
			array(
				'client_ip_address' => Request::client_ip(),
				'client_user_agent' => substr( Request::server( 'HTTP_USER_AGENT' ), 0, 512 ),
			)
		);
	}
}
