<?php
/**
 * Site-scoped, autoloaded settings persistence.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Settings;

/** Store one atomic settings option and return only public fields. */
final class Repository {

	/**
	 * Read validated public settings; corrupted storage disables tracking.
	 *
	 * @return array<string, mixed>
	 */
	public function get(): array {
		$raw    = get_option( 'pixelpair_settings', array() );
		$known  = is_array( $raw ) ? array_intersect_key( $raw, Defaults::all() ) : array();
		$result = Sanitizer::validate( $known, false );
		if ( is_wp_error( $result ) ) {
			return Defaults::all();
		}
		return $result;
	}

	/**
	 * Validate a partial update against the current complete object.
	 *
	 * @param array<string, mixed> $changes Raw proposed changes.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function update( array $changes ) {
		$raw = get_option( 'pixelpair_settings', array() );
		if ( ! is_array( $raw ) ) {
			return new \WP_Error( 'pixelpair_invalid_storage', __( 'Stored settings are invalid. Restore them before saving changes.', 'pixelpair' ), array( 'status' => 500 ) );
		}
		// Never persist the fail-closed rendering defaults over the owner's stored preferences.
		$known  = array_intersect_key( $raw, Defaults::all() );
		$result = Sanitizer::validate( array_replace( $known, $changes ), array_key_exists( 'excluded_roles', $changes ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$next = array_replace( $raw, $result );
		update_option( 'pixelpair_settings', $next, true );
		// update_option() also returns false for a successful no-op, so compare persisted state.
		if ( get_option( 'pixelpair_settings' ) !== $next ) {
			return new \WP_Error( 'pixelpair_save_failed', __( 'Settings could not be saved. Your previous settings are still active. Please try again.', 'pixelpair' ), array( 'status' => 500 ) );
		}
		return $result;
	}
}
