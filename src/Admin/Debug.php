<?php
/**
 * Uncached administrator-only debug authorization.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Admin;

/** Never embed administrator debug permission in cached HTML. */
final class Debug {

	/** Return flags only to authenticated site administrators. */
	public function handle(): void {
		nocache_headers();
		$s = ( new \PixelPair\Settings\Repository() )->get();
		if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'manage_pixelpair' ) || ! $s['debug_enabled'] ) {
			wp_send_json_error( null, 403 );
		}
		wp_send_json_success( array( 'hide_name' => $s['debug_hide_name'] ) );
	}
}
