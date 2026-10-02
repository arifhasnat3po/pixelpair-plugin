<?php
/**
 * Versioned, idempotent site-option migrations.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Settings;

use PixelPair\Support\Crypto;

// phpcs:disable WordPress.DB.DirectDatabaseQuery,WordPress.DB.SlowDBQuery -- Bounded identity migration; every changed metadata/option cache is invalidated.
/** Upgrade plugin options without overwriting settings. */
final class Migrations {
	/** Static compatibility key names, safe to share in cached HTML.
	 *
	 * @return array<string,string> No visitor values.
	 */
	public static function browser_keys(): array {
		return array(
			'session'        => 'tagpilot_session',
			'rule_prefix'    => 'tagpilot_rule_',
			'pending_cookie' => 'tagpilot_has_pending',
		);
	}

	/** Clear a consumed former flag cookie without creating tracking state.
	 *
	 * @param string $name Current flag-cookie name.
	 */
	public static function forget_cookie( string $name ): void {
		$old = str_replace( 'pixelpair_', 'tagpilot_', $name );
		unset( $_COOKIE[ $old ] );
		if ( ! headers_sent() ) {
			setcookie(
				$old,
				'',
				array(
					'expires'  => time() - HOUR_IN_SECONDS,
					'path'     => '/',
					'secure'   => is_ssl(),
					'httponly' => 'pixelpair_pending' === $name,
					'samesite' => 'Lax',
				)
			);
		}
	}

	/** Explain a recoverable table collision without exposing stored data. */
	public static function notice(): void {
		if ( current_user_can( 'manage_options' ) ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'PixelPair could not finish its data migration. Both old and new tracking tables may exist, or the database rejected a write. Tracking is paused. Ask your administrator to preserve both copies, resolve the database conflict, then reload this page to retry.', 'pixelpair' ) . '</p></div>';
		}
	}

	/** Disable the previous plugin on this site without affecting unrelated sites. */
	public static function retire_plugin(): void {
		$old    = 'tagpilot/tagpilot.php';
		$active = (array) get_option( 'active_plugins', array() );
		if ( in_array( $old, $active, true ) ) {
			update_option( 'active_plugins', array_values( array_diff( $active, array( $old ) ) ) );
		}
		$network = (array) get_site_option( 'active_sitewide_plugins', array() );
		if ( isset( $network[ $old ], $network['pixelpair/pixelpair.php'] ) ) {
			unset( $network[ $old ] );
			update_site_option( 'active_sitewide_plugins', $network );
		}
		// WordPress may already have loaded both main files for this request.
		global $wp_filter;
		foreach ( $wp_filter as $hook => $handler ) {
			foreach ( $handler->callbacks as $priority => $callbacks ) {
				foreach ( $callbacks as $callback ) {
					$fn    = $callback['function'];
					$class = is_array( $fn ) ? ( is_object( $fn[0] ) ? get_class( $fn[0] ) : $fn[0] ) : '';
					$file  = $fn instanceof \Closure ? ( new \ReflectionFunction( $fn ) )->getFileName() : '';
					if ( 0 === strpos( $class, 'TagPilot\\' ) || ( $file && false !== strpos( wp_normalize_path( $file ), '/tagpilot/' ) ) || 0 === strpos( $hook, 'tagpilot_' ) ) {
						remove_filter( $hook, $fn, $priority );
					}
				}
			}
		}
	}

	/** Remove old scheduler entries during deactivation/uninstall. */
	public static function clear_legacy_jobs(): void {
		foreach ( (array) _get_cron_array() as $hooks ) {
			foreach ( array_keys( $hooks ) as $hook ) {
				if ( 0 === strpos( $hook, 'tagpilot_' ) ) {
					wp_unschedule_hook( $hook );
				}
			}
		}
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( 'tagpilot_deliver', null, 'tagpilot' );
		}
	}

	/** Read uninstall retention even if an upgrade has not run.
	 *
	 * @return bool Owner's existing retention preference.
	 */
	public static function retain(): bool {
		$settings = get_option( 'pixelpair_settings', get_option( 'tagpilot_settings', array() ) );
		return is_array( $settings ) && ! empty( $settings['keep_data_on_uninstall'] );
	}

	/** Remove only both identities' owned data after retention is checked. */
	public static function uninstall(): void {
		global $wpdb;
		foreach ( array( 'tagpilot', 'pixelpair' ) as $name ) {
			foreach ( array( $name . '_', '_transient_' . $name . '_', '_transient_timeout_' . $name . '_' ) as $prefix ) {
				$keys = $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( $prefix ) . '%' ) );
				foreach ( $keys as $key ) {
					delete_option( $key );
				}
			}
			foreach ( self::meta_tables() as $type => $spec ) {
				list( $table, $id, $owner ) = $spec;
				if ( ! self::table_exists( $table ) ) {
					continue;
				}
				do {
					$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT %i,%i FROM %i WHERE meta_key LIKE %s LIMIT 100', $id, $owner, $table, $wpdb->esc_like( '_' . $name . '_' ) . '%' ), ARRAY_A );
					foreach ( $rows as $row ) {
						if ( false === $wpdb->delete( $table, array( $id => $row[ $id ] ) ) ) {
							break 2;
						}
						self::clear_meta_cache( $type, (int) $row[ $owner ] );
					}
					$count = count( $rows );
				} while ( 100 === $count );
			}
			$tables = $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $wpdb->prefix . $name . '_' ) . '%' ) );
			foreach ( $tables as $table ) {
				$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $table ) );
			}
			foreach ( array_keys( wp_roles()->roles ) as $role_name ) {
				$role = get_role( $role_name );
				if ( $role ) {
					$role->remove_cap( 'manage_' . $name );
				}
			}
		}
	}

	/** Copy the former identity once per site before services read settings.
	 *
	 * @return bool Whether runtime services can safely use the new tables.
	 */
	public static function identity(): bool {
		if ( '1' === get_option( 'pixelpair_identity_version' ) ) {
			if ( '1' !== get_option( 'pixelpair_legacy_batch_done' ) ) {
				self::schedule_batch();
			}
			return true;
		}
		global $wpdb;
		$tables = $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $wpdb->prefix . 'tagpilot_' ) . '%' ) );
		$legacy = ! empty( $tables ) || defined( 'TAGPILOT_FILE' );
		foreach ( $tables as $old ) {
			$new = $wpdb->prefix . 'pixelpair_' . substr( $old, strlen( $wpdb->prefix . 'tagpilot_' ) );
			if ( self::table_exists( $new ) || false === $wpdb->query( $wpdb->prepare( 'ALTER TABLE %i RENAME TO %i', $old, $new ) ) || ! self::table_exists( $new ) || self::table_exists( $old ) ) {
				return false;
			}
		}
		foreach ( array( 'tagpilot_', '_transient_tagpilot_', '_transient_timeout_tagpilot_' ) as $prefix ) {
			$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT option_name,autoload FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( $prefix ) . '%' ), ARRAY_A );
			$legacy = $legacy || ! empty( $rows );
			foreach ( $rows as $row ) {
				$old     = $row['option_name'];
				$new     = str_replace( 'tagpilot_', 'pixelpair_', $old );
				$missing = new \stdClass();
				if ( get_option( $new, $missing ) === $missing ) {
					$value = get_option( $old );
					if ( 'pixelpair_settings' === $new && is_array( $value ) ) {
						foreach ( array( 'google_data_layer', 'gtm_data_layer' ) as $field ) {
							if ( 'tagpilotDataLayer' === ( $value[ $field ] ?? '' ) ) {
								$value[ $field ] = 'pixelpairDataLayer';
							}
						}
					}
					if ( in_array( $new, array( 'pixelpair_secrets', 'pixelpair_tiktok_secrets' ), true ) && is_array( $value ) && ! empty( $value['token'] ) ) {
						$value['token'] = self::reencrypt( $value['token'] );
					}
					add_option( $new, $value, '', in_array( $row['autoload'], array( 'yes', 'on', 'auto', 'auto-on' ), true ) );
					if ( get_option( $new, $missing ) !== $value ) {
						return false;
					}
				}
				if ( ! delete_option( $old ) && false !== get_option( $old ) ) {
					return false;
				}
			}
		}
		foreach ( array_keys( wp_roles()->roles ) as $name ) {
			$role = get_role( $name );
			if ( $role && $role->has_cap( 'manage_tagpilot' ) ) {
				$role->add_cap( 'manage_pixelpair' );
				$role->remove_cap( 'manage_tagpilot' );
			}
		}
		foreach ( (array) _get_cron_array() as $time => $hooks ) {
			foreach ( $hooks as $hook => $events ) {
				if ( 0 !== strpos( $hook, 'tagpilot_' ) ) {
					continue;
				}
				$new = 'pixelpair_' . substr( $hook, strlen( 'tagpilot_' ) );
				foreach ( $events as $event ) {
					if ( ! wp_get_scheduled_event( $new, $event['args'], (int) $time ) ) {
						$ok = $event['schedule'] ? wp_schedule_event( (int) $time, $event['schedule'], $new, $event['args'] ) : wp_schedule_single_event( (int) $time, $new, $event['args'] );
						if ( ! $ok ) {
							return false;
						}
					}
					if ( false === wp_unschedule_event( (int) $time, $hook, $event['args'] ) ) {
						return false;
					}
				}
			}
		}
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( 'tagpilot_deliver', null, 'tagpilot' );
		}
		if ( $legacy ) {
			// Deleting the inactive old plugin must not erase metadata awaiting a batch.
			update_option(
				'tagpilot_settings',
				array(
					'keep_data_on_uninstall'        => true,
					'pixelpair_migration_retention' => true,
				),
				false
			);
		}
		self::schedule_batch();
		update_option( 'pixelpair_identity_version', '1', false );
		/** Updated option value after the write.
		 *
		 * @var mixed $version
		 */
		$version = get_option( 'pixelpair_identity_version' );
		return '1' === $version;
	}

	/** Decode authenticated old ciphertext without weakening its site binding.
	 *
	 * @param string $value Former encrypted value.
	 * @return string|null Plaintext only when authenticated for this site.
	 */
	public static function decrypt_legacy( string $value ): ?string {
		if ( 0 !== strpos( $value, 'v1:' ) ) {
			return null;
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Authenticated ciphertext, never executable input.
		$data = base64_decode( substr( $value, 3 ), true );
		if ( false === $data || strlen( $data ) < 28 ) {
			return null;
		}
		$context = 'tagpilot:' . get_current_blog_id();
		$key     = hash( 'sha256', (string) constant( 'AUTH_KEY' ) . (string) constant( 'SECURE_AUTH_SALT' ) . $context, true );
		$plain   = openssl_decrypt( substr( $data, 28 ), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr( $data, 0, 12 ), substr( $data, 12, 16 ), $context );
		return false === $plain ? null : $plain;
	}

	/** Keep unreadable values intact for recovery after a site-key repair.
	 *
	 * @param string $value Stored ciphertext.
	 * @return string Current ciphertext or the unchanged original.
	 */
	private static function reencrypt( string $value ): string {
		$plain = self::decrypt_legacy( $value );
		return null === $plain ? $value : Crypto::encrypt( $plain );
	}

	/** Run shared bookkeeping on the main site, also across multiple networks.
	 *
	 * @param callable $operation Option operation.
	 * @return mixed Operation result, with original blog context restored.
	 */
	private static function shared( callable $operation ) {
		$site   = is_multisite() ? (int) get_main_site_id( get_main_network_id() ) : get_current_blog_id();
		$result = null;
		\PixelPair\Support\Sites::on_site(
			$site,
			static function () use ( $operation, &$result ): void {
				$result = $operation();
			}
		);
		return $result;
	}

	/** Resume at most 100 rows with a shared lease for the global user-meta table. */
	public static function batch(): void {
		$key    = 'pixelpair_legacy_batch_lock';
		$lease  = array(
			'until' => time() + 300,
			'token' => wp_generate_uuid4(),
		);
		$locked = self::shared(
			static function () use ( $key, $lease ): bool {
				global $wpdb;
				$before = get_option( $key );
				if ( is_array( $before ) && ( $before['until'] ?? 0 ) < time() ) {
					$wpdb->delete(
						$wpdb->options,
						array(
							'option_name'  => $key,
							'option_value' => maybe_serialize( $before ),
						)
					);
					wp_cache_delete( $key, 'options' );
				}
				return add_option( $key, $lease, '', false );
			}
		);
		if ( ! $locked ) {
			self::schedule_batch();
			return; }
		try {
			self::batch_rows(); } finally {
			self::shared(
				static function () use ( $key, $lease ): void {
					global $wpdb;
					$wpdb->delete(
						$wpdb->options,
						array(
							'option_name'  => $key,
							'option_value' => maybe_serialize( $lease ),
						)
					);
					wp_cache_delete( $key, 'options' );
				}
			);
			}
	}

	/** Persist group precedence before changing any metadata.
	 *
	 * @param array<string,array<string,mixed>> $groups Incomplete metadata groups.
	 * @return bool Whether the write is visible.
	 */
	private static function save_groups( array $groups ): bool {
		return (bool) self::shared(
			static function () use ( $groups ): bool {
				update_option( 'pixelpair_legacy_meta_groups', $groups, false );
				return get_option( 'pixelpair_legacy_meta_groups' ) === $groups;
			}
		);
	}

	/** Migrate rows while holding the site-local batch lease. */
	private static function batch_rows(): void {
		global $wpdb;
		if ( ! self::identity() ) {
			self::schedule_batch();
			return;
		}
		$remaining = 100;
		$groups    = (array) self::shared(
			static function () {
				return get_option( 'pixelpair_legacy_meta_groups', array() );
			}
		);
		foreach ( self::meta_tables() as $type => $spec ) {
			list( $table, $id, $owner ) = $spec;
			if ( ! self::table_exists( $table ) || $remaining < 1 ) {
				continue;
			}
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE meta_key LIKE %s ORDER BY %i LIMIT %d', $table, $wpdb->esc_like( '_tagpilot_' ) . '%', $id, $remaining ), ARRAY_A );
			foreach ( $rows as $row ) {
				$new   = '_pixelpair_' . substr( $row['meta_key'], strlen( '_tagpilot_' ) );
				$group = hash( 'sha256', $table . ':' . $row[ $owner ] . ':' . $new );
				if ( ! array_key_exists( $group, $groups ) ) {
					$groups[ $group ] = array(
						'existing' => (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT %i FROM %i WHERE %i=%d AND meta_key=%s LIMIT 1', $id, $table, $owner, $row[ $owner ], $new ) ),
						'last'     => (int) $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(%i) FROM %i WHERE %i=%d AND meta_key=%s', $id, $table, $owner, $row[ $owner ], $row['meta_key'] ) ),
					);
					if ( ! self::save_groups( $groups ) ) {
						self::schedule_batch();
						return; }
				}
				// Migrated source rows retain their IDs. A later destination ID is a new write,
				// including a concurrent consent withdrawal, and must win atomically.
				$cutoff = $groups[ $group ]['existing'] ? 0 : $groups[ $group ]['last'];
				if ( ! $groups[ $group ]['existing'] ) {
					$value = '_pixelpair_context' === $new ? self::reencrypt( $row['meta_value'] ) : $row['meta_value'];
					$wpdb->query(
						$wpdb->prepare(
							'UPDATE %i AS source LEFT JOIN %i AS target ON target.%i=source.%i AND target.meta_key=%s AND target.%i>%d SET source.meta_key=%s,source.meta_value=%s WHERE source.%i=%d AND source.meta_key=%s AND source.meta_value=%s AND target.%i IS NULL',
							$table,
							$table,
							$owner,
							$owner,
							$new,
							$id,
							$cutoff,
							$new,
							$value,
							$id,
							$row[ $id ],
							$row['meta_key'],
							$row['meta_value'],
							$id
						)
					);
				}
				$wpdb->query(
					$wpdb->prepare(
						'DELETE source FROM %i AS source INNER JOIN %i AS target ON target.%i=source.%i AND target.meta_key=%s AND target.%i>%d WHERE source.%i=%d AND source.meta_key=%s AND source.meta_value=%s',
						$table,
						$table,
						$owner,
						$owner,
						$new,
						$id,
						$cutoff,
						$id,
						$row[ $id ],
						$row['meta_key'],
						$row['meta_value']
					)
				);
				self::clear_meta_cache( $type, (int) $row[ $owner ] );
				if ( ! $wpdb->get_var( $wpdb->prepare( 'SELECT %i FROM %i WHERE %i=%d AND meta_key=%s LIMIT 1', $id, $table, $owner, $row[ $owner ], $row['meta_key'] ) ) ) {
					unset( $groups[ $group ] );
					self::save_groups( $groups );
				}
				--$remaining;
			}
		}
		$table = $wpdb->prefix . 'pixelpair_jobs';
		if ( $remaining > 0 && self::table_exists( $table ) ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT id,payload FROM %i WHERE payload LIKE %s AND id>%d ORDER BY id LIMIT %d', $table, 'v1:%', (int) get_option( 'pixelpair_legacy_queue_cursor', 0 ), $remaining ), ARRAY_A );
			foreach ( $rows as $row ) {
				$replacement = self::reencrypt( $row['payload'] );
				$wpdb->update(
					$table,
					array( 'payload' => $replacement ),
					array(
						'id'      => $row['id'],
						'payload' => $row['payload'],
					)
				);
				$stored = $wpdb->get_var( $wpdb->prepare( 'SELECT payload FROM %i WHERE id=%d', $table, $row['id'] ) );
				if ( $replacement !== $row['payload'] && $stored === $row['payload'] ) {
					self::schedule_batch();
					return; }
				update_option( 'pixelpair_legacy_queue_cursor', (int) $row['id'], false );
				--$remaining;
			}
		}
		if ( $remaining < 100 ) {
			self::schedule_batch();
		} else {
			update_option( 'pixelpair_legacy_batch_done', '1', false );
			$old = get_option( 'tagpilot_settings' );
			if ( is_array( $old ) && ! empty( $old['pixelpair_migration_retention'] ) ) {
				delete_option( 'tagpilot_settings' );
			}
		}
	}

	/** Read current or unprocessed legacy metadata through its native API.
	 *
	 * @param string $type post, user, woo or edd.
	 * @param mixed  $entity Object or native ID.
	 * @param string $key Current plugin key.
	 * @return mixed Stored value, with destination precedence.
	 */
	public static function meta( string $type, $entity, string $key ) {
		$old = str_replace( '_pixelpair_', '_tagpilot_', $key );
		if ( 'woo' === $type ) {
			return $entity->get_meta( $entity->meta_exists( $key ) ? $key : $old );
		}
		if ( 'edd' === $type ) {
			$all = edd_get_order_meta( (int) $entity, $key, false );
			return $all ? edd_get_order_meta( (int) $entity, $key, true ) : edd_get_order_meta( (int) $entity, $old, true );
		}
		return get_metadata( $type, (int) $entity, metadata_exists( $type, (int) $entity, $key ) ? $key : $old, true );
	}

	/** Erase both identities so an unprocessed legacy value cannot reappear.
	 *
	 * @param string $type Store provider.
	 * @param mixed  $entity Order or ID.
	 * @param string $key Current key.
	 */
	public static function erase_meta( string $type, $entity, string $key ): void {
		foreach ( array( $key, str_replace( '_pixelpair_', '_tagpilot_', $key ) ) as $name ) {
			if ( 'woo' === $type ) {
				$entity->delete_meta_data( $name );
			} else {
				edd_delete_order_meta( (int) $entity, $name );
			}
		}
	}

	/** Move a live cart-session value on access, retaining destination values.
	 *
	 * @param object $session Native session service.
	 * @param string $key Current session key.
	 * @param mixed  $fallback Default for absent keys.
	 * @return mixed Session value.
	 */
	public static function session( $session, string $key, $fallback = null ) {
		$value = $session->get( $key );
		if ( null !== $value && false !== $value ) {
			return $value;
		}
		$old   = str_replace( 'pixelpair_', 'tagpilot_', $key );
		$value = $session->get( $old );
		if ( null !== $value && false !== $value ) {
			$session->set( $key, $value );
			$session->set( $old, null );
		}
		return null === $value || false === $value ? $fallback : $value;
	}

	/** Read continuity cookies without writing before consent is decided.
	 *
	 * @param string $name Current cookie name.
	 * @return string Untrusted bounded value; callers validate its protocol.
	 */
	public static function cookie( string $name ): string {
		$old = str_replace( 'pixelpair_', 'tagpilot_', $name );
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- Read-only compatibility; exact protocol validation belongs to each caller.
		$value = $_COOKIE[ $name ] ?? $_COOKIE[ $old ] ?? '';
		return is_string( $value ) && strlen( $value ) <= 4096 ? wp_unslash( $value ) : '';
	}

	/** Rewrite only plugin cookies on an already consented uncached collection path. */
	public static function cookies(): void {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- Names and bounded values are checked below; no platform cookies are changed.
		foreach ( $_COOKIE as $old => $value ) {
			if ( ! preg_match( '/\A_?tagpilot_[a-z0-9_]+\z/', $old ) || ! is_string( $value ) || strlen( $value ) > 4096 ) {
				continue;
			}
			$new = str_replace( 'tagpilot_', 'pixelpair_', $old );
			if ( 'pixelpair_visitor' === $new && ! preg_match( '/\A[a-f0-9]{32}\z/', $value ) ) {
				continue;
			}
			$options = array(
				'expires'  => time() + 90 * DAY_IN_SECONDS,
				'path'     => '/',
				'secure'   => is_ssl(),
				'httponly' => ! in_array( $new, array( 'pixelpair_has_pending', 'pixelpair_commerce_consent' ), true ),
				'samesite' => 'Lax',
			);
			if ( ! isset( $_COOKIE[ $new ] ) ) {
				$_COOKIE[ $new ] = $value;
				if ( ! headers_sent() ) {
					setcookie( $new, wp_unslash( $value ), $options );
				}
			}
			unset( $_COOKIE[ $old ] );
			$options['expires'] = time() - HOUR_IN_SECONDS;
			if ( ! headers_sent() ) {
				setcookie( $old, '', $options );
			}
		}
	}

	/** Schedule a resumable batch without putting data in cron arguments. */
	private static function schedule_batch(): void {
		if ( ! wp_next_scheduled( 'pixelpair_legacy_migrate' ) ) {
			wp_schedule_single_event( time() + 60, 'pixelpair_legacy_migrate' );
		}
	}

	/** Native metadata storage, including HPOS even when WooCommerce is disabled.
	 *
	 * @return array<string,array{string,string,string}> Table, primary key, owner key.
	 */
	private static function meta_tables(): array {
		global $wpdb;
		return array(
			'post' => array( $wpdb->postmeta, 'meta_id', 'post_id' ),
			'user' => array( $wpdb->usermeta, 'umeta_id', 'user_id' ),
			'woo'  => array( $wpdb->prefix . 'wc_orders_meta', 'id', 'order_id' ),
			'edd'  => array( $wpdb->prefix . 'edd_ordermeta', 'meta_id', 'edd_order_id' ),
		);
	}

	/** Clear native metadata caches after an atomic key rename.
	 *
	 * @param string $type Storage kind.
	 * @param int    $id Native owner ID.
	 */
	private static function clear_meta_cache( string $type, int $id ): void {
		wp_cache_delete( $id, $type . '_meta' );
		if ( 'edd' === $type ) {
			wp_cache_delete( $id, 'edd_order_meta' );
		}
		if ( in_array( $type, array( 'woo', 'post' ), true ) && class_exists( '\WC_Cache_Helper' ) ) {
			\WC_Cache_Helper::invalidate_cache_group( 'orders' );
			\WC_Cache_Helper::invalidate_cache_group( 'order_' . $id );
		}
	}

	/** Check an exact internally generated table name.
	 *
	 * @param string $table Owned table name.
	 * @return bool Whether it exists.
	 * @phpstan-impure
	 */
	private static function table_exists( string $table ): bool {
		global $wpdb;
		return $table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );
	}

	/** Apply only the schema shipped with this version. */
	public static function run(): void {
		if ( ! self::identity() ) {
			return;
		}
		self::schedule();
		if ( '7' === get_option( 'pixelpair_db_version' ) ) {
			return;
		}
		$stored = get_option( 'pixelpair_settings', array() );
		$values = array_replace( Defaults::all(), is_array( $stored ) ? $stored : array() );
		foreach ( $values['automatic_events'] as $key => &$event ) {
			if ( ! isset( $event['platforms']['tiktok'] ) && isset( Defaults::all()['automatic_events'][ $key ] ) ) {
				$event['platforms']['tiktok'] = Defaults::all()['automatic_events'][ $key ]['platforms']['tiktok'];
			}
		} unset( $event );
		update_option( 'pixelpair_settings', $values, true );
		\PixelPair\Events\Tables::install();
		add_option( 'pixelpair_rules', array(), '', true );
		update_option( 'pixelpair_db_version', '7', false );
		// Older core releases retain the previous cache location when autoload changes.
		wp_cache_delete( 'pixelpair_settings', 'options' );
		wp_cache_delete( 'pixelpair_db_version', 'options' );
		wp_cache_delete( 'alloptions', 'options' );
	}
	/** Restore housekeeping after reactivation as well as upgrades. */
	private static function schedule(): void {
		if ( ! wp_next_scheduled( 'pixelpair_queue_sweep' ) ) {
			wp_schedule_event( time() + 60, 'hourly', 'pixelpair_queue_sweep' );
		}
		if ( ! wp_next_scheduled( 'pixelpair_log_purge' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'pixelpair_log_purge' );
		}
	}
}
