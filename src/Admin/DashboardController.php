<?php
/**
 * Local configuration status without vendor requests.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Admin;

/** Report configured state separately from live delivery verification. */
final class DashboardController {

	/** Register status endpoint. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/dashboard',
			array(
				'methods'             => 'GET',
				'permission_callback' => array( new SettingsController(), 'permissions' ),
				'callback'            => function () {
					return new \WP_REST_Response( $this->status(), 200, \PixelPair\Events\BootstrapController::headers() );
				},
			)
		);
	}
	/**
	 * Gather bounded status and actionable configuration checks.
	 *
	 * @return array<string,mixed>
	 */
	public function status(): array {
		$s         = ( new \PixelPair\Settings\Repository() )->get();
		$platforms = array();
		$checks    = array();
		foreach ( array( 'meta', 'tiktok', 'ga4', 'gtm' ) as $id ) {
			$key              = 'ga4' === $id ? 'ga4_ids' : ( 'gtm' === $id ? 'gtm_id' : $id . '_pixel_id' );
			$server           = in_array( $id, array( 'meta', 'tiktok' ), true );
			$secret           = $server ? ( new \PixelPair\Settings\Secrets( $id ) )->status() : array();
			$logs             = $server ? ( new \PixelPair\Logs\Repository() )->listing( 1, '', $id )['items'] : array();
			$platforms[ $id ] = array(
				'enabled'         => $s[ $id . '_enabled' ],
				'id_set'          => ! empty( $s[ $key ] ),
				'server_enabled'  => $server && ! empty( $s[ $id . '_capi_enabled' ] ),
				'credentials_set' => $server && ( new \PixelPair\Settings\Secrets( $id ) )->token() !== '',
				'test_mode'       => $server && ( new \PixelPair\Settings\Secrets( $id ) )->test_code() !== '',
				'last_event'      => $logs ? array_intersect_key( $logs[0], array_flip( array( 'status', 'event_name', 'response_code', 'created_at' ) ) ) : null,
			);
			if ( $platforms[ $id ]['server_enabled'] && ! $platforms[ $id ]['credentials_set'] ) {
				$checks[] = array(
					'code'    => $id . '_credentials',
					/* translators: %s: platform identifier. */
					'message' => sprintf( __( '%s server delivery needs a saved access token.', 'pixelpair' ), $id ),
				);
			}
		}
		if ( ! $s['strict_cache_mode'] ) {
			$checks[] = array(
				'code'    => 'fast_cache',
				'message' => __( 'Fast mode assumes logged-in pages are not shared from cache. Enable Strict cache mode if your cache serves logged-in visitors.', 'pixelpair' ),
			);
		}
		if ( ! $s['deny_until_consent'] && ! ( new \PixelPair\Integrations\Consent\ConsentManager() )->config()['required'] ) {
			$checks[] = array(
				'code'    => 'consent_default',
				'message' => __( 'Marketing is allowed when no consent tool is detected. Configure consent before targeting visitors who require it.', 'pixelpair' ),
			);
		}
		return array(
			'version'             => PIXELPAIR_VERSION,
			'platforms'           => $platforms,
			'checks'              => $checks,
			'onboarding_complete' => $s['onboarding_complete'],
		);
	}
}
