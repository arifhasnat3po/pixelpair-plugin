<?php
/**
 * Credential and explicit test-event administration.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Admin;

use PixelPair\Settings\Secrets;
use PixelPair\Events\Event;
use PixelPair\Platforms\Meta\{Payload, Client};

/** All operations require capability and nonce, including credential status. */
final class MetaController {
	/** Register admin-only resources. */
	public function register_routes(): void {
		$permissions = array( new SettingsController(), 'permissions' );
		register_rest_route(
			'pixelpair/v1',
			'/meta',
			array(
				'methods'             => array( 'GET', 'POST' ),
				'permission_callback' => $permissions,
				'callback'            => array( $this, 'handle' ),
			)
		);
		register_rest_route(
			'pixelpair/v1',
			'/meta/test',
			array(
				'methods'             => 'POST',
				'permission_callback' => $permissions,
				'callback'            => array( $this, 'test' ),
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
		$store = new Secrets();
		if ( 'POST' === $request->get_method() ) {
			$raw = strlen( $request->get_body() ) <= 8192 ? json_decode( $request->get_body() ) : null;
			if ( ! $raw instanceof \stdClass ) {
				return new \WP_Error( 'pixelpair_invalid_body', __( 'Send a valid credentials object.', 'pixelpair' ), array( 'status' => 400 ) );
			}
			$result = $store->update( (array) $raw );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}
		return new \WP_REST_Response( $store->status(), 200, \PixelPair\Events\BootstrapController::headers() );
	}
	/**
	 * Service operation.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function test() {
		if ( '' === ( new Secrets() )->test_code() ) {
			return new \WP_Error( 'pixelpair_test_code_required', __( 'Save an active test event code before sending a test.', 'pixelpair' ), array( 'status' => 400 ) );
		}
		$event  = new Event(
			'page_view',
			wp_generate_uuid4(),
			time(),
			home_url( '/' ),
			array(),
			array(
				'client_user_agent' => 'PixelPair administrator test',
				'external_id'       => array( hash( 'sha256', 'pixelpair-test-' . wp_generate_uuid4() ) ),
			)
		);
		$result = ( new Client() )->send( Payload::build( $event ) );
		( new \PixelPair\Logs\Repository() )->record( 'PageView', $result['success'] ? 'sent' : 'failed', $result );
		return new \WP_REST_Response( $result, 200, \PixelPair\Events\BootstrapController::headers() );
	}
}
