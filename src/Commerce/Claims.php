<?php
/**
 * Persistent event identity and atomic per-destination receipt claims.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Commerce;

// phpcs:disable WordPress.DB.DirectDatabaseQuery -- Unique inserts and bitwise updates coordinate independent requests, never cached HTML.
/**
 * Keep purchase identity beyond queue retention.
 */
final class Claims {

	/**
	 * Provide validated commerce data.
	 *
	 * @param string $key Provider-qualified identity.
	 * @return string UUID.
	 * @throws \RuntimeException When persistent identity storage fails.
	 */
	public static function id( string $key ): string {
		global $wpdb;
		$hash   = hash( 'sha256', $key );
		$expiry = preg_match( '/\A(?:woo|edd):(?:purchase|refund):/', $key ) ? 0 : time() + 2 * DAY_IN_SECONDS;
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}pixelpair_claims (claim_key,event_id,browser_mask,server_mask,created_at,expires_at) VALUES (%s,%s,0,0,%d,%d)", $hash, wp_generate_uuid4(), time(), $expiry ) );
		$id = $wpdb->get_var( $wpdb->prepare( "SELECT event_id FROM {$wpdb->prefix}pixelpair_claims WHERE claim_key=%s", $hash ) );
		if ( ! is_string( $id ) || ! preg_match( '/\A[0-9a-f-]{36}\z/', $id ) ) {
			throw new \RuntimeException( 'Commerce identity storage is unavailable.' );
		}
		return $id;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $platform Destination.
	 * @return int Bit.
	 */
	private static function bit( string $platform ): int {
		return array(
			'meta'   => 1,
			'ga4'    => 2,
			'gtm'    => 4,
			'tiktok' => 8,
		)[ $platform ] ?? 0;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $key Identity.
	 * @param string $platform Destination.
	 * @return bool Claim acquired.
	 */
	public static function claim_browser( string $key, string $platform ): bool {
		global $wpdb;
		$bit = self::bit( $platform );
		if ( ! $bit ) {
			return false;
		}
		self::id( $key );
		return 1 === $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}pixelpair_claims SET browser_mask=browser_mask|%d WHERE claim_key=%s AND (browser_mask & %d)=0", $bit, hash( 'sha256', $key ), $bit ) );
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $key Identity.
	 * @param string $platform Destination.
	 * @return bool Previously queued.
	 */
	public static function server_done( string $key, string $platform ): bool {
		global $wpdb;
		$mask = (int) $wpdb->get_var( $wpdb->prepare( "SELECT server_mask FROM {$wpdb->prefix}pixelpair_claims WHERE claim_key=%s", hash( 'sha256', $key ) ) );
		$bit  = self::bit( $platform );
		return $bit && ( $mask & $bit ) === $bit;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $key Identity.
	 * @param string $platform Destination.
	 */
	public static function mark_server( string $key, string $platform ): void {
		global $wpdb;
		$bit = self::bit( $platform );
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}pixelpair_claims SET server_mask=server_mask|%d WHERE claim_key=%s", $bit, hash( 'sha256', $key ) ) );
	}
	/**
	 * Purge expired catalog/cart identities while preserving purchase deduplication.
	 */
	public static function purge(): void {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pixelpair_claims WHERE expires_at>0 AND expires_at<%d", time() ) );
	}
}
