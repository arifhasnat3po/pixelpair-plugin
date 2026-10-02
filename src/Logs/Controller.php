<?php
/**
 * Authorized bounded log read, export and clear operations.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Logs;

/** Expose only the already-redacted log store. */
final class Controller {
	/** Register the administrator log resource. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/logs',
			array(
				'methods'             => array( 'GET', 'DELETE' ),
				'permission_callback' => array( new \PixelPair\Admin\SettingsController(), 'permissions' ),
				'callback'            => array( $this, 'handle' ),
			)
		);
	}
	/**
	 * Service operation.
	 *
	 * @param \WP_REST_Request $request Admin request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$store = new Repository();
		if ( 'DELETE' === $request->get_method() ) {
			if ( 'yes' !== $request->get_param( 'confirm' ) ) {
				return new \WP_Error( 'pixelpair_confirmation_required', __( 'Confirm before clearing logs.', 'pixelpair' ), array( 'status' => 400 ) );
			}
			$store->clear();
		}
		$status   = $request->get_param( 'status' );
		$platform = $request->get_param( 'platform' );
		return new \WP_REST_Response( $store->listing( (int) $request->get_param( 'page' ), is_string( $status ) ? $status : '', is_string( $platform ) ? $platform : '' ), 200, \PixelPair\Events\BootstrapController::headers() );
	}
}
