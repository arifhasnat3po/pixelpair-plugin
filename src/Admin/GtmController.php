<?php
/**
 * Restricted, secrets-free container download.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Admin;

/** Export only generated public GTM configuration. */
final class GtmController {
	/** Register the restricted download endpoint. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/gtm-export',
			array(
				'methods'             => 'GET',
				'permission_callback' => array( new SettingsController(), 'permissions' ),
				'callback'            => array( $this, 'download' ),
			)
		);
	}
	/**
	 * Service operation.
	 *
	 * @return \WP_REST_Response Generated JSON.
	 */
	public function download(): \WP_REST_Response {
		return new \WP_REST_Response( \PixelPair\Platforms\GTM\ContainerExport::build(), 200, \PixelPair\Events\BootstrapController::headers() );
	}
}
