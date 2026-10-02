<?php
/**
 * Durable encrypted delivery with atomic claims and bounded retries.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

use PixelPair\Support\Crypto;
use PixelPair\Settings\Repository;
use PixelPair\Platforms\Meta\Payload;
use PixelPair\Platforms\Meta\Client;

// phpcs:disable WordPress.DB.DirectDatabaseQuery -- Operational queue is deliberately uncached; SQL atomically claims leases.
/** Store event data outside cron arguments and clear it at completion. */
final class Queue {
	/**
	 * Service operation.
	 *
	 * @param Event  $event Accepted consented event.
	 * @param string $platform Fixed server destination.
	 * @param string $subject Provider-qualified commerce identity.
	 * @return int|\WP_Error
	 */
	public function enqueue( Event $event, string $platform = 'meta', string $subject = '' ) {
		global $wpdb;
		if ( ! in_array( $platform, array( 'meta', 'tiktok' ), true ) ) {
			return new \WP_Error( 'pixelpair_platform', 'Unsupported platform.' ); }
		$payload    = 'tiktok' === $platform ? \PixelPair\Platforms\TikTok\Payload::build( $event ) : Payload::build( $event );
		$event_name = $payload['event_name'] ?? $payload['event'] ?? '';
		$pixel      = ( new Repository() )->get()[ $platform . '_pixel_id' ];
		if ( ! $payload ) {
			return new \WP_Error( 'pixelpair_event_disabled', __( 'This event is not configured.', 'pixelpair' ), array( 'status' => 400 ) );
		}
		$key      = hash( 'sha256', ( 'tiktok' === $platform ? 'tiktok|' : '' ) . $pixel . '|' . $event_name . '|' . $event->event_id );
		$existing = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}pixelpair_jobs WHERE event_key=%s", $key ) );
		if ( $existing ) {
			return (int) $existing;
		}
		$envelope = array(
			'internal_name' => $event->name,
			'pixel_id'      => $pixel,
			'platform'      => $platform,
			'subject'       => $subject,
			'event'         => $payload,
		);
		try {
			$encrypted = Crypto::encrypt( (string) wp_json_encode( $envelope ) );
		} catch ( \Throwable $error ) {
			return new \WP_Error( 'pixelpair_queue_failed', __( 'The event could not be queued.', 'pixelpair' ), array( 'status' => 503 ) );
		}
			// A unique key makes simultaneous duplicates harmless. No overwrite of an accepted event.
			$inserted = $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}pixelpair_jobs (event_key,subject_key,event_name,status,attempts,next_at,lease_until,payload,created_at) VALUES (%s,%s,%s,'pending',0,%d,0,%s,%d)", $key, $subject ? self::subject_key( $subject ) : '', $event_name, time(), $encrypted, time() ) );
			$id       = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}pixelpair_jobs WHERE event_key=%s", $key ) );
		if ( false === $inserted || ! $id ) {
			return new \WP_Error( 'pixelpair_queue_failed', __( 'The event could not be queued.', 'pixelpair' ), array( 'status' => 503 ) );
		}
			$this->schedule( $id, time() );
			return $id;
	}
	/**
	 * Service operation.
	 *
	 * @param int $id Stored job ID, no personal data in scheduler arguments.
	 */
	public function run( int $id ): void {
		global $wpdb;
		$claimed = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}pixelpair_jobs SET status='processing',lease_until=%d,attempts=attempts+1 WHERE id=%d AND next_at<=%d AND attempts<4 AND (status='pending' OR (status='processing' AND lease_until<%d))", time() + 120, $id, time(), time() ) );
		if ( 1 !== $claimed ) {
			return;
		}
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d", $id ), ARRAY_A );
		if ( ! is_array( $row ) ) {
			return;
		}
		$plain     = Crypto::decrypt( $row['payload'] );
		$stored    = null === $plain ? null : json_decode( $plain, true );
		$settings  = ( new Repository() )->get();
		$platform  = is_array( $stored ) && 'tiktok' === ( $stored['platform'] ?? '' ) ? 'tiktok' : 'meta';
		$enabled   = $settings[ $platform . '_enabled' ] && $settings[ $platform . '_capi_enabled' ] && false !== ( new \PixelPair\Integrations\Consent\ConsentManager() )->override();
		$mapping   = Mapping::get( is_array( $stored ) ? ( $stored['internal_name'] ?? 'page_view' ) : '', $platform );
		$platforms = ( new EventManager() )->platform_config();
		$enabled   = $enabled && ! empty( $platforms[ $platform ]['enabled'] ) && $mapping && $mapping['server'] && ( $stored['event']['event_name'] ?? $stored['event']['event'] ?? '' ) === $mapping['name'];
		if ( preg_match( '/\A(woo|edd)_purchase\z/', $stored['internal_name'] ?? '' ) ) {
			$enabled = $enabled && \PixelPair\Commerce\Consent::order_allowed( $stored['subject'] ?? '' );
		}
		if ( ! $enabled || ! is_array( $stored ) || ( $stored['pixel_id'] ?? '' ) !== $settings[ $platform . '_pixel_id' ] || ! is_array( $stored['event'] ?? null ) ) {
			$result = array( 'code' => 0 );
			$status = 'cancelled';
		} else {
			if ( ! $settings[ $platform . '_advanced_matching' ] ) {
				$field                     = 'tiktok' === $platform ? 'user' : 'user_data';
				$baseline                  = 'tiktok' === $platform ? array( 'external_id', 'ttp', 'ttclid', 'ip', 'user_agent' ) : array( 'external_id', 'fbp', 'fbc', 'client_ip_address', 'client_user_agent' );
				$stored['event'][ $field ] = array_intersect_key( (array) ( $stored['event'][ $field ] ?? array() ), array_flip( $baseline ) );
			}
			$result = ( 'tiktok' === $platform ? new \PixelPair\Platforms\TikTok\Client() : new Client() )->send( $stored['event'] );
			$status = $result['success'] ? 'sent' : ( $result['retry'] && (int) $row['attempts'] < 4 ? 'pending' : 'failed' );
		}
		$delay = array( 60, 300, 900 )[ min( 2, (int) $row['attempts'] - 1 ) ];
		$wpdb->update(
			$wpdb->prefix . 'pixelpair_jobs',
			array(
				'status'      => $status,
				'payload'     => 'pending' === $status ? Crypto::encrypt( (string) wp_json_encode( $stored ) ) : '',
				'next_at'     => time() + $delay,
				'lease_until' => 0,
			),
			array(
				'id'     => $id,
				'status' => 'processing',
			),
			array( '%s', '%s', '%d', '%d' ),
			array( '%d', '%s' )
		);
		( new \PixelPair\Logs\Repository() )->record( $row['event_name'], 'pending' === $status ? 'retry' : $status, $result, $platform );
		if ( 'pending' === $status ) {
			$this->schedule( $id, time() + $delay );
		}
	}
	/** Cancel and erase only this order's pending work.
	 *
	 * @param string $subject Provider-qualified purchase identity.
	 */
	public static function erase_subject( string $subject ): void {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}pixelpair_jobs SET status='cancelled',payload='',lease_until=0 WHERE subject_key=%s AND status IN ('pending','processing')", self::subject_key( $subject ) ) );
	}
	/** Derive a site-local opaque lookup key.
	 *
	 * @param string $subject Order identity.
	 * @return string
	 */
	private static function subject_key( string $subject ): string {
		return hash_hmac( 'sha256', $subject, wp_salt( 'nonce' ) );
	}
	/** Recover missed scheduler callbacks and expired leases in bounded batches. */
	public function sweep(): void {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}pixelpair_jobs SET status='failed',payload='',lease_until=0 WHERE status='processing' AND attempts>=4 AND lease_until<%d", time() ) );
		$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}pixelpair_jobs WHERE next_at<=%d AND (status='pending' OR (status='processing' AND lease_until<%d)) LIMIT 20", time(), time() ) );
		foreach ( $ids as $id ) {
			$this->run( (int) $id );
		}
	}
	/**
	 * Service operation.
	 *
	 * @param int $id Job ID.
	 * @param int $when Unix timestamp.
	 */
	private function schedule( int $id, int $when ): void {
		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action( $when, 'pixelpair_deliver', array( $id ), 'pixelpair', false );
		} elseif ( ! wp_next_scheduled( 'pixelpair_deliver', array( $id ) ) ) {
			wp_schedule_single_event( $when, 'pixelpair_deliver', array( $id ) );
			// Core spawn_cron uses a nonblocking loopback and respects DISABLE_WP_CRON.
			if ( $when <= time() && ( ! defined( 'DISABLE_WP_CRON' ) || ! DISABLE_WP_CRON ) ) {
				add_action(
					'shutdown',
					static function (): void {
						spawn_cron();
					}
				);
			}
		}
	}
}
