<?php
/**
 * Stop plugin-owned scheduled work without deleting data.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair;

use PixelPair\Support\Sites;

/** Stop plugin jobs while retaining settings. */
final class Deactivation {
	/**
	 * Stop scheduled work in the relevant sites.
	 *
	 * @param bool|null $network_wide Whether the entire network is deactivated; WP-CLI may leave it unspecified.
	 */
	public static function deactivate( ?bool $network_wide = false ): void {
		if ( is_multisite() && $network_wide ) {
			Sites::each( array( self::class, 'clear_jobs' ), get_current_network_id() );
			return;
		}
		self::clear_jobs();
	}

	/** Unschedule all argument variants of the hooks owned by the plugin. */
	public static function clear_jobs(): void {
		wp_unschedule_hook( 'pixelpair_legacy_migrate' );
		\PixelPair\Settings\Migrations::clear_legacy_jobs();
		wp_unschedule_hook( 'pixelpair_initialize_network' );
		foreach ( array( 'pixelpair_deliver', 'pixelpair_queue_sweep', 'pixelpair_log_purge', 'pixelpair_woo_purchase', 'pixelpair_edd_purchase' ) as $hook ) {
			wp_unschedule_hook( $hook );
		}
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( 'pixelpair_deliver', null, 'pixelpair' );
		}
	}
}
