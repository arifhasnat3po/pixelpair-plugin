<?php
/**
 * Public read-only eligibility gate with current visitor authentication.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

use PixelPair\Exclusions\ExclusionManager;
use PixelPair\Integrations\Consent\ConsentManager;
use PixelPair\Support\Request;
use PixelPair\Support\RateLimiter;

/** Return only public configuration, never events or identity data. */
final class BootstrapController {
	/** Register both cookie-authenticated and anonymous Ajax paths. */
	public function register(): void {
		add_action( 'wp_ajax_pixelpair_bootstrap', array( $this, 'handle' ) );
		add_action( 'wp_ajax_nopriv_pixelpair_bootstrap', array( $this, 'handle' ) );
	}
	/**
	 * Provide a cache policy independent of the response result.
	 *
	 * @return array<string, string>
	 */
	public static function headers(): array {
		return array(
			'Cache-Control'          => 'private, no-store, max-age=0',
			'Vary'                   => 'Cookie, Origin',
			'X-Content-Type-Options' => 'nosniff',
		);
	}
	/**
	 * Validate and evaluate a bounded same-origin request.
	 *
	 * @param string $body Raw JSON.
	 * @param string $origin Browser Origin header (Referer fallback when absent).
	 * @param string $method HTTP method.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function evaluate( string $body, string $origin, string $method ) {
		if ( 'POST' !== $method || ! Request::same_origin( $origin, home_url() ) ) {
			return $this->error( 403 );
		}
		if ( strlen( $body ) > 8192 ) {
			return $this->error( 413 );
		}
		$data = json_decode( $body );
		if ( ! $data instanceof \stdClass || array_diff( array_keys( (array) $data ), array( 'url', 'consent', 'category' ) ) || ! isset( $data->url, $data->consent ) || ! is_string( $data->url ) || strlen( $data->url ) > 4096 || ! Request::same_origin( $data->url, home_url() ) || ! $data->consent instanceof \stdClass || ( isset( $data->category ) && ! in_array( $data->category, array( 'marketing', 'statistics' ), true ) ) ) {
			return $this->error( 400 );
		}
		$consent = (array) $data->consent;
		if ( array_diff( array_keys( $consent ), array( 'source', 'granted' ) ) || ! isset( $consent['source'], $consent['granted'] ) || ! is_string( $consent['source'] ) || ! is_bool( $consent['granted'] ) || ! in_array( $consent['source'], array( 'default', 'integration', 'wp-consent-api', 'cookiebot', 'cookieyes', 'complianz', 'borlabs', 'real-cookie-banner', 'unresolved' ), true ) ) {
			return $this->error( 400 );
		}
		if ( ! RateLimiter::allow( Request::client_ip() ) ) {
			return $this->error( 429 );
		}
		$platforms = ( new EventManager() )->platform_config();
		$meta      = $platforms['meta'] ?? array(
			'enabled'  => false,
			'pixel_id' => '',
		);
		$category  = $data->category ?? 'marketing';
		$permitted = ( new ConsentManager() )->allows( $category, $consent );
		$marketing = 'marketing' === $category && $permitted;
		$allowed   = $permitted && ( new ExclusionManager() )->should_track( $data->url );
		$result    = array(
			'allowed'           => $allowed,
			'marketing_allowed' => $marketing,
			'meta'              => array(
				'enabled'  => $allowed && $marketing && ! empty( $meta['enabled'] ),
				'pixel_id' => $allowed ? ( $meta['pixel_id'] ?? '' ) : '',
			),
		);
		foreach ( array( 'ga4', 'gtm', 'tiktok' ) as $id ) {
			if ( isset( $platforms[ $id ] ) ) {
				$result[ $id ]            = $platforms[ $id ];
				$result[ $id ]['enabled'] = $allowed && ! empty( $platforms[ $id ]['enabled'] );
			}
		}
		return $result;
	}
	/** Emit JSON with no permissive cross-origin access or cacheable response. */
	public function handle(): void {
		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Credentials' );
		foreach ( self::headers() as $name => $value ) {
			header( $name . ': ' . $value );
		}
		$origin = Request::server( 'HTTP_ORIGIN' );
		$origin = '' !== $origin ? $origin : Request::server( 'HTTP_REFERER' );
		$body   = file_get_contents( 'php://input', false, null, 0, 8193 );
		$result = $this->evaluate( false === $body ? '' : $body, $origin, Request::server( 'REQUEST_METHOD' ) );
		if ( is_wp_error( $result ) ) {
			wp_send_json(
				array(
					'allowed'           => false,
					'marketing_allowed' => false,
					'meta'              => array(
						'enabled'  => false,
						'pixel_id' => '',
					),
				),
				$result->get_error_data()['status']
			);
		}
		wp_send_json( $result );
	}
	/**
	 * Return a non-sensitive protocol error.
	 *
	 * @param int $status HTTP status.
	 * @return \WP_Error
	 */
	private function error( int $status ): \WP_Error {
		return new \WP_Error( 'pixelpair_gate_rejected', __( 'Eligibility could not be confirmed.', 'pixelpair' ), array( 'status' => $status ) );
	}
}
