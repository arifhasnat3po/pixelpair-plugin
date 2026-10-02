<?php
/**
 * Retention-aware cleanup limited to plugin-owned state.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair;

use PixelPair\Support\Sites;

/** Remove only plugin-owned data when retention permits. */
final class Uninstall {
	/** Remove owned data across sites, respecting each site's retention setting. */
	public static function run(): void {
		Sites::each(
			static function (): void {
				Deactivation::clear_jobs();
				if ( Settings\Migrations::retain() ) {
					return;
				}
				Settings\Migrations::uninstall();
			}
		);
	}
}
