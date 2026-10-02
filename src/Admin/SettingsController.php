<?php
/**
 * Authenticated settings REST controller.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Admin;

use PixelPair\Settings\Repository;
use PixelPair\Settings\Schema;

/** Keep settings access behind both capability and REST nonce checks. */
final class SettingsController {

	/** Register the administrator settings resource. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/settings',
			array(
				'methods'             => array( 'GET', 'POST' ),
				'permission_callback' => array( $this, 'permissions' ),
				'callback'            => array( $this, 'handle' ),
				'schema'              => array( Schema::class, 'rest_schema' ),
			)
		);
	}

	/**
	 * Check authorization even during direct REST dispatch.
	 *
	 * @param \WP_REST_Request $request Current request.
	 * @return true|\WP_Error
	 */
	public function permissions( \WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_pixelpair' ) || ! wp_verify_nonce( (string) $request->get_header( 'X-WP-Nonce' ), 'wp_rest' ) ) {
			return new \WP_Error( 'pixelpair_forbidden', __( 'You cannot manage PixelPair settings.', 'pixelpair' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Validate the raw JSON object before REST can coerce field types.
	 *
	 * @param \WP_REST_Request $request Current request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$repository = new Repository();
		$result     = $repository->get();
		if ( 'POST' === $request->get_method() ) {
			$body   = $request->get_body();
			$object = strlen( $body ) <= 16384 ? json_decode( $body ) : null;
			if ( ! $object instanceof \stdClass ) {
				return new \WP_Error( 'pixelpair_invalid_body', __( 'Send a JSON settings object smaller than 16 KB.', 'pixelpair' ), array( 'status' => 400 ) );
			}
			$result = $repository->update( json_decode( $body, true ) );
		}
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return new \WP_REST_Response( $result, 200, array( 'Cache-Control' => 'private, no-store, max-age=0' ) );
	}
}
