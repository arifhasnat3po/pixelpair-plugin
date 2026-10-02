<?php
/**
 * Redacted operational log storage, never raw request/response dumps.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Logs;

// phpcs:disable WordPress.DB.DirectDatabaseQuery -- Log reads/writes are restricted to uncached workers and authorized administration.
/** Bound logs and discard identifying fields at the storage boundary. */
final class Repository {
	/**
	 * Service operation.
	 *
	 * @param string               $event Configured event name.
	 * @param string               $status Outcome.
	 * @param array<string, mixed> $result Transport result.
	 * @param string               $platform Destination key.
	 */
	public function record( string $event, string $status, array $result, string $platform = 'meta' ): void {
		if ( ! ( new \PixelPair\Settings\Repository() )->get()['logging_enabled'] ) {
			return;
		}
		global $wpdb;
		$details = array(
			'request'  => array(
				'event_name'   => $event,
				'user_data'    => '[redacted]',
				'custom_data'  => '[redacted]',
				'access_token' => '[redacted]',
			),
			'response' => array_intersect_key( (array) ( $result['response'] ?? array() ), array_flip( array( 'events_received', 'error_code' ) ) ),
		);
		$wpdb->insert(
			$wpdb->prefix . 'pixelpair_logs',
			array(
				'platform'      => $platform,
				'event_name'    => $event,
				'status'        => $status,
				'response_code' => (int) ( $result['code'] ?? 0 ),
				'details'       => wp_json_encode( $details ),
				'created_at'    => time(),
			),
			array( '%s', '%s', '%s', '%d', '%s', '%d' )
		);
	}
	/**
	 * Service operation.
	 *
	 * @param int    $page Page number.
	 * @param string $status Optional status.
	 * @param string $platform Optional platform.
	 * @return array<string, mixed>
	 */
	public function listing( int $page = 1, string $status = '', string $platform = '' ): array {
		global $wpdb;
		$page        = max( 1, min( 10000, $page ) );
		$pattern     = in_array( $status, array( 'sent', 'failed', 'retry', 'cancelled' ), true ) ? $status : '%';
		$destination = in_array( $platform, array( 'meta', 'tiktok' ), true ) ? $platform : '%';
		$rows        = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pixelpair_logs WHERE status LIKE %s AND platform LIKE %s ORDER BY id DESC LIMIT 50 OFFSET %d", $pattern, $destination, ( $page - 1 ) * 50 ), ARRAY_A );
		$total       = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}pixelpair_logs WHERE status LIKE %s AND platform LIKE %s", $pattern, $destination ) );
		return array(
			'items' => $rows,
			'total' => (int) $total,
			'page'  => $page,
		);
	}
	/** Delete logs only after an authorized admin operation. */
	public function clear(): void {
		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}pixelpair_logs" );
	}
	/** Purge expired logs and terminal replay records daily. */
	public function purge(): void {
		global $wpdb;
		$days = ( new \PixelPair\Settings\Repository() )->get()['log_retention_days'];
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pixelpair_logs WHERE created_at < %d", time() - $days * DAY_IN_SECONDS ) );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pixelpair_jobs WHERE created_at < %d", time() - 7 * DAY_IN_SECONDS ) );
	}
}
