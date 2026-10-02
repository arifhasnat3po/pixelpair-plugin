<?php
/**
 * Site-scoped durable event delivery and redacted logs.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

/** Install owned tables through WordPress schema migration. */
final class Tables {
	/** Install idempotently on activation/admin migration, never on cached rendering. */
	public static function install(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$collate = $wpdb->get_charset_collate();
		dbDelta(
			"CREATE TABLE {$wpdb->prefix}pixelpair_claims (
		claim_key varchar(64) NOT NULL,
		event_id varchar(36) NOT NULL,
		browser_mask int NOT NULL DEFAULT 0,
		server_mask int NOT NULL DEFAULT 0,
		created_at bigint NOT NULL,
		expires_at bigint NOT NULL DEFAULT 0,
		KEY expiry (expires_at),
		PRIMARY KEY  (claim_key)
		) $collate;"
		);
		dbDelta(
			"CREATE TABLE {$wpdb->prefix}pixelpair_events (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		name varchar(120) NOT NULL,
		status varchar(16) NOT NULL DEFAULT 'paused',
		trigger_json longtext NOT NULL,
		conditions_json longtext NOT NULL,
		platform_json longtext NOT NULL,
		once_per_session tinyint NOT NULL DEFAULT 0,
		created_at bigint NOT NULL,
		updated_at bigint NOT NULL,
		PRIMARY KEY  (id)
		) $collate;"
		);
		dbDelta(
			"CREATE TABLE {$wpdb->prefix}pixelpair_jobs (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		event_key varchar(64) NOT NULL,
		subject_key varchar(64) NOT NULL DEFAULT '',
		event_name varchar(64) NOT NULL,
		status varchar(16) NOT NULL DEFAULT 'pending',
		attempts int NOT NULL DEFAULT 0,
		next_at bigint NOT NULL,
		lease_until bigint NOT NULL DEFAULT 0,
		payload longtext NOT NULL,
		created_at bigint NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY event_key (event_key),
		KEY subject_key (subject_key),
		KEY ready (status,next_at)
		) $collate;"
		);
		dbDelta(
			"CREATE TABLE {$wpdb->prefix}pixelpair_logs (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		platform varchar(16) NOT NULL,
		event_name varchar(64) NOT NULL,
		status varchar(16) NOT NULL,
		response_code int NOT NULL DEFAULT 0,
		details longtext NOT NULL,
		created_at bigint NOT NULL,
		PRIMARY KEY  (id),
		KEY history (created_at),
		KEY status (status)
		) $collate;"
		);
	}
	/** Clear operational data from the two owned tables. */
	public static function clear(): void {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery -- These uncached operational tables have no object-cache entries.
		$wpdb->query( "DELETE FROM {$wpdb->prefix}pixelpair_jobs" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}pixelpair_logs" );
		// phpcs:enable
	}
}
