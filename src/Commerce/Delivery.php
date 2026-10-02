<?php
/**
 * Shared commerce event delivery and receipt claims.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Commerce;

use PixelPair\Events\{Event, Mapping, Queue};
/**
 * Queue only verified store events with preserved identity.
 */
final class Delivery {

	/**
	 * Provide validated commerce data.
	 *
	 * @param string              $key Durable identity.
	 * @param string              $name Internal event.
	 * @param array<string,mixed> $snapshot Store data.
	 * @param array<string,mixed> $context Captured consent.
	 * @return string Shared UUID.
	 */
	public static function enqueue( string $key, string $name, array $snapshot, array $context ): string {
		$id = Claims::id( $key );
		$s  = ( new \PixelPair\Settings\Repository() )->get();
		if ( preg_match( '/\A(woo|edd):purchase:[1-9][0-9]*\z/', $key ) && ! Consent::order_allowed( $key ) ) {
			return $id;
		}
		foreach ( array( 'meta', 'tiktok' ) as $platform ) {
			if ( Consent::retained( $context, 'marketing' ) && $s[ $platform . '_enabled' ] && $s[ $platform . '_capi_enabled' ] && Mapping::get( $name, $platform ) && ! Claims::server_done( $key, $platform ) ) {
						$event  = new Event( $name, $id, time(), home_url( '/' ), $snapshot, \PixelPair\UserData\Collector::permitted( (array) ( $context[ 'tiktok' === $platform ? 'tiktok_matching' : 'matching' ] ?? array() ), $platform ) );
						$result = ( new Queue() )->enqueue( $event, $platform, $key );
				if ( ! is_wp_error( $result ) ) {
					Claims::mark_server( $key, $platform );
				}
			}
		}
		return $id;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string              $key Identity.
	 * @param string              $name Event.
	 * @param array<string,mixed> $snapshot Store values.
	 * @param array<string,mixed> $context Current consent.
	 * @param string[]            $targets Ready destinations.
	 * @param bool                $once Claim each destination once.
	 * @return array<string,mixed> Browser envelope without matching data.
	 */
	public static function browser( string $key, string $name, array $snapshot, array $context, array $targets, bool $once = false ): array {
		$id  = self::enqueue( $key, $name, $snapshot, $context );
		$out = array(
			'event_id'  => $id,
			'name'      => $name,
			'platforms' => array(),
		);
		$s   = ( new \PixelPair\Settings\Repository() )->get();
		foreach ( array_intersect( $targets, array( 'meta', 'ga4', 'gtm', 'tiktok' ) ) as $platform ) {
			$mapping = Mapping::get( $name, $platform );
			$allowed = 'ga4' === $platform ? Consent::retained( $context, 'statistics' ) : Consent::retained( $context, 'marketing' );
			if ( 'gtm' === $platform ) {
				$allowed = $allowed && Consent::retained( $context, 'statistics' );
			}
			if ( ! $allowed || empty( $s[ $platform . '_enabled' ] ) || ! $mapping || ( $once && ! Claims::claim_browser( $key, $platform ) ) ) {
				continue;
			}
			$params = Payload::map( $snapshot, $platform );
			if ( 'meta' === $platform && $s['meta_sensitive_data'] ) {
				$params = \PixelPair\Platforms\Meta\Payload::safe_params( $params );
			}
			$out['platforms'][ $platform ] = array(
				'name'   => $mapping['name'],
				'params' => $params,
			);
		}
		return $out;
	}
}
