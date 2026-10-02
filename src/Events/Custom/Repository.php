<?php
/**
 * Durable rules and an autoloaded read snapshot.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Custom;

/** SQL is limited to admin mutation/listing; rendering reads only the compiled option. */
final class Repository {
	/**
	 * Replace portable settings and rules under the normal mutation lock.
	 *
	 * @param list<array<string,mixed>> $rules Validated portable rules.
	 * @param array<string,mixed>       $settings Validated settings.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function replace_all( array $rules, array $settings ) {
		return $this->mutate(
			static function () use ( $rules, $settings ) {
				global $wpdb;
			// phpcs:disable WordPress.DB.DirectDatabaseQuery -- Atomic import touches only owned configuration and rules.
				if ( ! defined( 'DB_ENGINE' ) || 'sqlite' !== DB_ENGINE ) {
					foreach ( array( $wpdb->options, $wpdb->prefix . 'pixelpair_events' ) as $table ) {
						$engine = $wpdb->get_row( $wpdb->prepare( 'SHOW TABLE STATUS WHERE Name = %s', $table ), ARRAY_A );
						if ( ! is_array( $engine ) || 'innodb' !== strtolower( (string) ( $engine['Engine'] ?? '' ) ) ) {
							return new \WP_Error( 'pixelpair_import_engine', __( 'Import requires InnoDB tables, or the supported SQLite integration, so a failed import can be rolled back.', 'pixelpair' ), array( 'status' => 409 ) );}
					}
				}
				if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
					return new \WP_Error( 'pixelpair_import_transaction', __( 'The database could not start an import transaction.', 'pixelpair' ), array( 'status' => 500 ) );}
				try {
					// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Preserve WordPress core option-filter contracts inside the transaction.
					$old      = get_option( 'pixelpair_settings', array() );
					$next     = array_replace( is_array( $old ) ? $old : array(), $settings );
					$filtered = apply_filters( 'pre_update_option_pixelpair_settings', sanitize_option( 'pixelpair_settings', $next ), $old, 'pixelpair_settings' );
					$filtered = apply_filters( 'pre_update_option', $filtered, 'pixelpair_settings', $old );
					// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
					// Do not publish uncommitted options through update_option's shared cache.
					if ( $filtered !== $next || ! self::write_import_option( 'pixelpair_settings', $next ) ) {
						throw new \RuntimeException( 'settings' );}
					if ( false === $wpdb->query( "DELETE FROM {$wpdb->prefix}pixelpair_events" ) ) {
						throw new \RuntimeException( 'events' );}
					$compiled = array();foreach ( $rules as $rule ) {
						$ok = $wpdb->insert(
							$wpdb->prefix . 'pixelpair_events',
							array(
								'name'             => $rule['name'],
								'status'           => $rule['status'],
								'trigger_json'     => wp_json_encode( $rule['triggers'] ),
								'conditions_json'  => wp_json_encode( $rule['conditions'] ),
								'platform_json'    => wp_json_encode( $rule['platforms'] ),
								'once_per_session' => (int) $rule['once_per_session'],
								'created_at'       => time(),
								'updated_at'       => time(),
							)
						);
						if ( false === $ok ) {
							throw new \RuntimeException( 'event' );}
						$id = (int) $wpdb->insert_id;
						if ( 'active' === $rule['status'] ) {
							$compiled[ $id ] = array_merge(
								$rule,
								array(
									'id'         => $id,
									'created_at' => time(),
									'updated_at' => time(),
								)
							);}
					}
					if ( ! self::write_import_option( 'pixelpair_rules', $compiled ) || false === $wpdb->query( 'COMMIT' ) ) {
						throw new \RuntimeException( 'commit' );}
					return array(
						'imported' => true,
						'events'   => count( $rules ),
					);
				} catch ( \Throwable $error ) {
					$wpdb->query( 'ROLLBACK' );
					return new \WP_Error( 'pixelpair_import_rollback', __( 'Import failed and was rolled back. Your prior configuration remains active.', 'pixelpair' ), array( 'status' => 500 ) );
				} finally {
					foreach ( array( 'pixelpair_settings', 'pixelpair_rules', 'alloptions', 'notoptions' ) as $key ) {
						wp_cache_delete( $key, 'options' );}
				}
			// phpcs:enable
			}
		);
	}
	/** Write within the caller's transaction without changing shared caches.
	 *
	 * @param string       $name Owned option name.
	 * @param array<mixed> $value Validated option.
	 * @return bool
	 */
	private static function write_import_option( string $name, array $value ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Cache invalidation happens only after commit/rollback.
		return false !== $wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,%s,'yes') ON DUPLICATE KEY UPDATE option_value=VALUES(option_value),autoload=VALUES(autoload)", $name, maybe_serialize( $value ) ) );
	}
	/**
	 * Service operation.
	 *
	 * @return list<array<string,mixed>> All rules for administration.
	 */
	public function all(): array {
		global $wpdb;
	 // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Administrative reads; public rendering uses rules().
		$rows = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pixelpair_events ORDER BY id DESC LIMIT 101", ARRAY_A );
		return array_map( array( $this, 'decode' ), $rows );
	}
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $row Database row.
	 * @return array<string,mixed> Rule.
	 */
	public function decode( array $row ): array {
		return array(
			'id'               => (int) $row['id'],
			'name'             => $row['name'],
			'status'           => $row['status'],
			'triggers'         => json_decode( $row['trigger_json'], true ),
			'conditions'       => json_decode( $row['conditions_json'], true ),
			'platforms'        => array_replace(
				array(
					'tiktok' => array(
						'enabled' => false,
						'name'    => 'CustomEvent',
						'params'  => array(),
						'server'  => false,
					),
				),
				json_decode( $row['platform_json'], true ) ?? array()
			),
			'once_per_session' => (bool) $row['once_per_session'],
			'created_at'       => (int) $row['created_at'],
			'updated_at'       => (int) $row['updated_at'],
		);
	}
	/**
	 * Service operation.
	 *
	 * @return array<int,array<string,mixed>> Active compiled rules, no custom-table queries.
	 */
	public function rules(): array {
		$value = get_option( 'pixelpair_rules', array() );
		if ( ! is_array( $value ) || count( $value ) > 100 ) {
			return array();
		}
		foreach ( $value as $id => $rule ) {
			if ( ! is_array( $rule ) || is_wp_error( Validator::validate( $rule ) ) || ( $rule['id'] ?? 0 ) !== $id ) {
				return array();
			}
		}return $value;
	}
	/**
	 * Service operation.
	 *
	 * @param int $id Rule ID.
	 * @return array<string,mixed>|null Current authoritative rule for uncached ingestion.
	 */
	public function current( int $id ): ?array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Anonymous ingestion and workers recheck current rule state, bypassing stale page snapshots.
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pixelpair_events WHERE id=%d", $id ), ARRAY_A );
		if ( ! is_array( $row ) ) {
			return null;
		}
		$rule = $this->decode( $row );
		return is_wp_error( Validator::validate( $rule ) ) ? null : $rule;
	}
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $data Rule.
	 * @param int                 $id Existing ID or zero.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function save( array $data, int $id = 0 ) {
		$rule = Validator::validate( $data );
		if ( is_wp_error( $rule ) ) {
			return $rule;
		}
		return $this->mutate(
			static function () use ( $rule, $id ) {
				global $wpdb;
				$repo  = new self();
				$all   = $repo->all();
				$found = false;
				foreach ( $all as $existing ) {
					if ( $existing['id'] === $id ) {
						$found = true;
					}
				}
				if ( ( $id && ! $found ) || ( ! $id && count( $all ) >= 100 ) ) {
					return new \WP_Error( 'pixelpair_rule_limit', __( 'Event not found or the 100-event limit was reached.', 'pixelpair' ), array( 'status' => 400 ) );
				}
				$values = array(
					'name'             => $rule['name'],
					'status'           => $rule['status'],
					'trigger_json'     => wp_json_encode( $rule['triggers'] ),
					'conditions_json'  => wp_json_encode( $rule['conditions'] ),
					'platform_json'    => wp_json_encode( $rule['platforms'] ),
					'once_per_session' => (int) $rule['once_per_session'],
					'updated_at'       => time(),
				);
	 // phpcs:disable WordPress.DB.DirectDatabaseQuery -- Serialized administrative mutation under the rules lock.
				if ( $id ) {
					$ok = $wpdb->update( $wpdb->prefix . 'pixelpair_events', $values, array( 'id' => $id ) );
				} else {
					$values['created_at'] = time();
					$ok                   = $wpdb->insert( $wpdb->prefix . 'pixelpair_events', $values );
					$id                   = (int) $wpdb->insert_id;
				}
	 // phpcs:enable
				return false === $ok ? new \WP_Error( 'pixelpair_rule_save', __( 'The event could not be saved.', 'pixelpair' ), array( 'status' => 500 ) ) : array_merge( $rule, array( 'id' => $id ) );
			}
		);
	}
	/**
	 * Service operation.
	 *
	 * @param int $id Source rule.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function duplicate( int $id ) {
		foreach ( $this->all() as $rule ) {
			if ( $rule['id'] === $id ) {
				$rule['name']   = mb_substr( $rule['name'], 0, 100 ) . ' ' . __( '(copy)', 'pixelpair' );
				$rule['status'] = 'paused';
				return $this->save( $rule );
			}
		}return new \WP_Error( 'pixelpair_not_found', __( 'Event not found.', 'pixelpair' ), array( 'status' => 404 ) );
	}
	/**
	 * Service operation.
	 *
	 * @param int $id Rule to delete.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function delete( int $id ) {
		return $this->mutate(
			static function () use ( $id ) {
				global $wpdb;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Explicit authenticated rule deletion.
				$ok = $wpdb->delete( $wpdb->prefix . 'pixelpair_events', array( 'id' => $id ) );
				return false === $ok ? new \WP_Error( 'pixelpair_delete_failed', __( 'Event could not be deleted.', 'pixelpair' ), array( 'status' => 500 ) ) : array( 'deleted' => true );
			}
		);
	}
	/**
	 * Service operation.
	 *
	 * @param callable(): (array<string,mixed>|\WP_Error) $operation Mutation.
	 * @return array<string,mixed>|\WP_Error
	 */
	private function mutate( callable $operation ) {
		global $wpdb;
		$lock = get_option( 'pixelpair_rules_lock' );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery -- Atomic lock claims cannot use read-then-write option helpers.
		if ( is_string( $lock ) && (int) explode( ':', $lock )[0] < time() - 60 ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name='pixelpair_rules_lock' AND option_value=%s", $lock ) );
		}
		$token   = time() . ':' . bin2hex( random_bytes( 8 ) );
		$claimed = $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} (option_name,option_value,autoload) VALUES ('pixelpair_rules_lock',%s,'no')", $token ) );
		wp_cache_delete( 'pixelpair_rules_lock', 'options' );
		wp_cache_delete( 'notoptions', 'options' );
		if ( 1 !== $claimed ) {
			return new \WP_Error( 'pixelpair_rules_busy', __( 'Another event edit is in progress. Please retry.', 'pixelpair' ), array( 'status' => 409 ) );
		}
		try {
			$result = $operation();
			if ( is_wp_error( $result ) ) {
				return $result;
			}
			$compiled = array();
			foreach ( $this->all() as $rule ) {
				if ( 'active' === $rule['status'] ) {
					$compiled[ $rule['id'] ] = $rule;
				}
			}update_option( 'pixelpair_rules', $compiled, true );
			if ( get_option( 'pixelpair_rules' ) !== $compiled ) {
				delete_option( 'pixelpair_rules' );
				return new \WP_Error( 'pixelpair_rules_cache', __( 'Event stored, but its tracking cache could not be refreshed. Save again before using it.', 'pixelpair' ), array( 'status' => 500 ) );
			}return $result;
		} finally {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name='pixelpair_rules_lock' AND option_value=%s", $token ) );
			wp_cache_delete( 'pixelpair_rules_lock', 'options' );
			wp_cache_delete( 'notoptions', 'options' );
			// phpcs:enable
		}
	}
}
