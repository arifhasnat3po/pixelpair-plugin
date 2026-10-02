<?php
/**
 * Uncached current-visitor roles and one-use action flags.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

use PixelPair\Support\Request;
/** Authenticate signed WordPress cookies locally without exposing identity in HTML. */
final class ContextController {
	/** Register the explicitly public, same-origin context endpoint. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/context',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => array( $this, 'handle' ),
			)
		);
	}
	/**
	 * Service operation.
	 *
	 * @param \WP_REST_Request $request Browser context request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$previous = get_current_user_id();
		$user     = wp_validate_auth_cookie( '', 'logged_in' );
		wp_set_current_user( $user ? (int) $user : 0 );
		try {
			$origin = Request::server( 'HTTP_ORIGIN' );
			$origin = '' !== $origin ? $origin : Request::server( 'HTTP_REFERER' );
			$gate   = ( new BootstrapController() )->evaluate( $request->get_body(), $origin, $request->get_method() );
			if ( is_wp_error( $gate ) ) {
				return $gate;
			}
			if ( empty( $gate['allowed'] ) ) {
				return new \WP_Error( 'pixelpair_context_denied', __( 'Tracking context is unavailable.', 'pixelpair' ), array( 'status' => 403 ) );
			}
			return new \WP_REST_Response(
				array(
					'roles' => array_values( wp_get_current_user()->roles ),
					'flags' => Automatic\Flags::consume( get_current_user_id() ),
				),
				200,
				BootstrapController::headers()
			);
		} finally {
			wp_set_current_user( $previous );
		}
	}
}
