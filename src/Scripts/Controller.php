<?php
/**
 * Script administration and verified receipt substitution.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Scripts;

/**
 * Keep receipt values out of shared cached HTML.
 */
final class Controller {

	/**
	 * Register script resources.
	 */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/scripts',
			array(
				'methods'             => array( 'GET', 'POST' ),
				'permission_callback' => array( $this, 'permissions' ),
				'callback'            => array( $this, 'handle' ),
			)
		);
		register_rest_route(
			'pixelpair/v1',
			'/script-receipt',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => array( $this, 'receipt' ),
			)
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \WP_REST_Request $request Authenticated request.
	 * @return true|\WP_Error
	 */
	public function permissions( \WP_REST_Request $request ) {
		$result = ( new \PixelPair\Admin\SettingsController() )->permissions( $request );
		return true === $result && Repository::allowed() ? true : new \WP_Error( 'pixelpair_scripts_forbidden', __( 'Script management requires unfiltered HTML permission.', 'pixelpair' ), array( 'status' => 403 ) );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \WP_REST_Request $request Authorized request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$repo   = new Repository();
		$result = $repo->get();
		if ( 'POST' === $request->get_method() ) {
			$data = strlen( $request->get_body() ) <= 140000 ? json_decode( $request->get_body(), true ) : null;
			if ( ! is_array( $data ) ) {
				return new \WP_Error( 'pixelpair_invalid_scripts', __( 'Send a valid scripts object.', 'pixelpair' ), array( 'status' => 400 ) );
			}
			$result = $repo->save( $data );
		}
		return is_wp_error( $result ) ? $result : new \WP_REST_Response( $result, 200, \PixelPair\Events\BootstrapController::headers() );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \WP_REST_Request $request Consented same-origin receipt request.
	 * @return \WP_REST_Response
	 */
	public function receipt( \WP_REST_Request $request ): \WP_REST_Response {
		$previous = get_current_user_id();
		wp_set_current_user( (int) wp_validate_auth_cookie( '', 'logged_in' ) );
		$code = '';
		try {
			$gate = ( new \PixelPair\Events\BootstrapController() )->evaluate( $request->get_body(), (string) $request->get_header( 'origin' ), 'POST' );
			$body = json_decode( $request->get_body(), true );
			$row  = ( new Repository() )->get()['receipt'];
			if ( ! is_wp_error( $gate ) && ! empty( $gate['allowed'] ) && ( $body['category'] ?? 'marketing' ) === $row['consent'] && function_exists( 'wc_get_order' ) ) {
				parse_str( (string) wp_parse_url( $body['url'], PHP_URL_QUERY ), $query );
				$order = is_string( $query['key'] ?? null ) && strlen( $query['key'] ) < 128 ? \PixelPair\Integrations\WooCommerce\Data::receipt( $query['key'] ) : null;
				if ( $order ) {
					$code = Renderer::substitute(
						$row['code'],
						array(
							'order_id'    => $order->get_id(),
							'order_total' => (float) $order->get_total(),
							'currency'    => $order->get_currency(),
						)
					);
				}
			}
		} finally {
			wp_set_current_user( $previous );
		}
		return new \WP_REST_Response( array( 'code' => $code ), '' === $code ? 403 : 200, \PixelPair\Events\BootstrapController::headers() );
	}
}
