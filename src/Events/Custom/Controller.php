<?php
/**
 * Authenticated custom-event administration.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Custom;

/** List, save, duplicate and delete validated rules. */
final class Controller {
	/** Register capability- and nonce-protected endpoints. */
	public function register_routes(): void {
		foreach ( array( '/events', '/events/(?P<id>[1-9][0-9]*)' ) as $route ) {
			register_rest_route(
				'pixelpair/v1',
				$route,
				array(
					'methods'             => array( 'GET', 'POST', 'DELETE' ),
					'permission_callback' => array( new \PixelPair\Admin\SettingsController(), 'permissions' ),
					'callback'            => array( $this, 'handle' ),
				)
			);
		}}
	/**
	 * Service operation.
	 *
	 * @param \WP_REST_Request $request Authorized request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$repo   = new Repository();
		$id     = (int) $request->get_param( 'id' );
		$method = $request->get_method();
		if ( 'GET' === $method ) {
			$result = $repo->all();
		} else {
			$data = strlen( $request->get_body() ) <= 16384 ? json_decode( $request->get_body(), true ) : null;
			if ( ! is_array( $data ) ) {
				return new \WP_Error( 'pixelpair_invalid_body', __( 'Send a valid event object.', 'pixelpair' ), array( 'status' => 400 ) );
			}
			if ( 'DELETE' === $method ) {
				if ( ! $id || ( $data['confirm'] ?? '' ) !== 'yes' ) {
					return new \WP_Error( 'pixelpair_confirmation', __( 'Confirm event deletion.', 'pixelpair' ), array( 'status' => 400 ) );
				}
				$result = $repo->delete( $id );
			} elseif ( ( $data['action'] ?? '' ) === 'duplicate' ) {
				$result = $repo->duplicate( $id );
			} else {
				$result = $repo->save( $data, $id );
			}
		}
		return is_wp_error( $result ) ? $result : new \WP_REST_Response( $result, 200, \PixelPair\Events\BootstrapController::headers() );
	}
}
