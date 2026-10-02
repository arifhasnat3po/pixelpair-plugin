<?php
/**
 * Per-site activation and bounded network initialization.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair;

use PixelPair\Settings\Migrations;
use PixelPair\Support\Sites;
use WP_Site;

/** Initialize plugin-owned site state. */
final class Activation {
	/**
	 * Activate the current site or start a network batch.
	 *
	 * @param bool|null $network_wide Whether network activation was requested; WP-CLI may leave it unspecified.
	 */
	public static function activate( ?bool $network_wide = false ): void {
		if ( is_multisite() && $network_wide ) {
			self::initialize_network( get_current_network_id() );
			return;
		}
		self::initialize_site( get_current_blog_id() );
	}

	/**
	 * Set up defaults and the administrator capability for one site.
	 *
	 * @param int $blog_id Site ID.
	 */
	public static function initialize_site( int $blog_id ): void {
		Sites::on_site(
			$blog_id,
			static function (): void {
				Migrations::run();
				$administrator = get_role( 'administrator' );
				if ( $administrator ) {
					$administrator->add_cap( 'manage_pixelpair' );
				}
			}
		);
	}

	/**
	 * Initialize at most 100 sites, then schedule the next batch.
	 *
	 * @param int $network_id Network ID.
	 * @param int $offset     Number of sites already processed.
	 */
	public static function initialize_network( int $network_id, int $offset = 0 ): void {
		/** Site IDs returned by the fields=ids query.
		 *
		 * @var list<int> $ids
		 */
		$ids = get_sites(
			array(
				'network_id' => $network_id,
				'fields'     => 'ids',
				'number'     => 100,
				'offset'     => $offset,
				'orderby'    => 'id',
				'order'      => 'ASC',
			)
		);
		foreach ( $ids as $blog_id ) {
			self::initialize_site( (int) $blog_id );
		}
		if ( 100 === count( $ids ) ) {
			Sites::on_site(
				(int) get_main_site_id( $network_id ),
				static function () use ( $network_id, $offset ): void {
					$args = array( $network_id, $offset + 100 );
					if ( ! wp_next_scheduled( 'pixelpair_initialize_network', $args ) ) {
						wp_schedule_single_event( time() + 10, 'pixelpair_initialize_network', $args );
					}
				}
			);
		}
	}

	/**
	 * Initialize a new site only when this plugin is active for its network.
	 *
	 * @param WP_Site $site The fully initialized site.
	 */
	public static function on_created_site( WP_Site $site ): void {
		$active = get_network_option( (int) $site->network_id, 'active_sitewide_plugins', array() );
		if ( is_array( $active ) && isset( $active[ plugin_basename( PIXELPAIR_FILE ) ] ) ) {
			self::initialize_site( (int) $site->blog_id );
		}
	}
}
