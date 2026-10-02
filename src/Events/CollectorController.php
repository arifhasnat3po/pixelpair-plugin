<?php
/**
 * Public same-origin event collector; never trusts browser identity.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

use PixelPair\Support\{Request, RateLimiter};
use PixelPair\Settings\Repository;
use PixelPair\Exclusions\ExclusionManager;
use PixelPair\Integrations\Consent\ConsentManager;
use PixelPair\UserData\Collector;

/** Recheck authorization-to-track independently of cached HTML. */
final class CollectorController {
	/** Register an explicitly public endpoint; tracking eligibility lives inside evaluate. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/event',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => array( $this, 'handle' ),
			)
		);
		register_rest_route(
			'pixelpair/v1',
			'/identity',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => array( $this, 'identity' ),
			)
		);
	}
	/**
	 * Service operation.
	 *
	 * @param \WP_REST_Request $request Same-origin consented identity request.
	 * @return \WP_REST_Response
	 */
	public function identity( \WP_REST_Request $request ): \WP_REST_Response {
		$previous = get_current_user_id();
		wp_set_current_user( (int) wp_validate_auth_cookie( '', 'logged_in' ) );
		try {
			$gate     = ( new BootstrapController() )->evaluate( $request->get_body(), (string) $request->get_header( 'origin' ), $request->get_method() );
			$settings = ( new Repository() )->get();
			$platform = 'tiktok' === $request->get_param( 'platform' ) ? 'tiktok' : 'meta';
			if ( is_wp_error( $gate ) || empty( $gate['allowed'] ) || empty( $gate['marketing_allowed'] ) || empty( $gate[ $platform ]['enabled'] ) || ! $settings[ $platform . '_advanced_matching' ] ) {
				return new \WP_REST_Response( array( 'matching' => (object) array() ), 403, BootstrapController::headers() );
			}
			$body = json_decode( $request->get_body(), true );
			$data = ( new Collector() )->collect( $body['url'], $platform );
			$out  = array();
			foreach ( array( 'em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'db', 'ge', 'external_id' ) as $key ) {
				if ( isset( $data[ $key ][0] ) ) {
					$out[ $key ] = $data[ $key ][0];
				}
			}
			return new \WP_REST_Response( array( 'matching' => (object) $out ), 200, BootstrapController::headers() );
		} finally {
			wp_set_current_user( $previous );
		}
	}
	/**
	 * Service operation.
	 *
	 * @param \WP_REST_Request $request Public request.
	 * @return \WP_REST_Response
	 */
	public function handle( \WP_REST_Request $request ): \WP_REST_Response {
		$origin = (string) $request->get_header( 'origin' );
		$result = $this->evaluate( $request->get_body(), '' !== $origin ? $origin : (string) $request->get_header( 'referer' ), $request->get_method() );
		return new \WP_REST_Response(
			is_wp_error( $result ) ? array(
				'accepted' => false,
				'code'     => $result->get_error_code(),
			) : $result,
			is_wp_error( $result ) ? $result->get_error_data()['status'] : 202,
			BootstrapController::headers()
		);
	}
	/**
	 * Service operation.
	 *
	 * @param string $body JSON body.
	 * @param string $origin Browser origin.
	 * @param string $method HTTP method.
	 * @return array<string, bool>|\WP_Error
	 */
	public function evaluate( string $body, string $origin, string $method ) {
		if ( 'POST' !== $method || ! Request::same_origin( $origin, home_url() ) ) {
			return $this->error( 403 );
		}
		if ( strlen( $body ) > 16384 ) {
			return $this->error( 413 );
		}
		$data = json_decode( $body );
		if ( ! $data instanceof \stdClass || array_diff( array_keys( (array) $data ), array( 'event_name', 'expected_name', 'event_id', 'source_url', 'params', 'consent', 'matching', 'platform' ) ) || ! isset( $data->event_name, $data->event_id, $data->source_url, $data->params, $data->consent ) || ! is_string( $data->event_name ) || ! is_string( $data->event_id ) || ! preg_match( '/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i', $data->event_id ) || ! is_string( $data->source_url ) || strlen( $data->source_url ) > 4096 || ! Request::same_origin( $data->source_url, home_url() ) || ! $data->params instanceof \stdClass || ! $data->consent instanceof \stdClass ) {
			return $this->error( 400 );
		}
		$decision = (array) $data->consent;
		if ( preg_match( '/\A(woo|edd)_/', $data->event_name ) ) {
			return $this->error( 400 );
		}
		$platform = $data->platform ?? 'meta';
		if ( ! in_array( $platform, array( 'meta', 'tiktok' ), true ) ) {
			return $this->error( 400 ); }
		$mapping = Mapping::get( $data->event_name, $platform );
		if ( array_diff( array_keys( $decision ), array( 'granted', 'source' ) ) || ! isset( $decision['granted'], $decision['source'] ) || ! is_bool( $decision['granted'] ) || ! is_string( $decision['source'] ) || ! $mapping || ! $mapping['server'] ) {
			return $this->error( 400 );
		}
		if ( ! isset( $data->expected_name ) || ! is_string( $data->expected_name ) || $data->expected_name !== $mapping['name'] ) {
			return $this->error( 409 );
		}
		$params = (array) $data->params;
		if ( count( $params ) > 48 || strlen( (string) wp_json_encode( $params, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) > 11000 ) {
			return $this->error( 400 );
		}
		foreach ( $params as $key => $value ) {
			if ( ! preg_match( '/\A[a-zA-Z][a-zA-Z0-9_]{0,63}\z/', $key ) || ! is_scalar( $value ) || ( is_string( $value ) && strlen( $value ) > 1024 ) ) {
				return $this->error( 400 );
			}
		}
		if ( ! RateLimiter::allow( Request::client_ip(), 'event' ) ) {
			return $this->error( 429 );
		}
		$previous = get_current_user_id();
		// WordPress deliberately clears cookie auth on nonce-free REST. Validate only its signed logged-in cookie.
		$user_id = wp_validate_auth_cookie( '', 'logged_in' );
		wp_set_current_user( $user_id ? (int) $user_id : 0 );
		try {
			$settings = ( new Repository() )->get();
			$matching = array();
			if ( preg_match( '/\Acustom_([1-9][0-9]*)\z/', $data->event_name, $rule_match ) ) {
				$rule = ( new Custom\Repository() )->current( (int) $rule_match[1] );
				foreach ( $rule['conditions'] ?? array() as $condition ) {
					if ( 'role' === $condition['type'] ) {
						$roles   = wp_get_current_user()->roles;
						$matches = 'logged-out' === $condition['value'] ? empty( $roles ) : in_array( $condition['value'], $roles, true );
						if ( ! $matches ) {
							return $this->error( 403 );
						}
					}
				}
			}
			if ( isset( $data->matching ) ) {
				if ( ! $data->matching instanceof \stdClass || 'form_submit' !== $data->event_name || ! $settings['capture_form_fields'] || ! $settings[ $platform . '_advanced_matching' ] || array_diff( array_keys( (array) $data->matching ), array( 'em', 'ph' ) ) ) {
					return $this->error( 400 );
				}
				foreach ( (array) $data->matching as $key => $value ) {
					if ( ! is_string( $value ) || ! preg_match( '/\A[a-f0-9]{64}\z/', $value ) ) {
						return $this->error( 400 );
					}
					$matching[ $key ] = array( $value );
				}
			}
			$platforms = ( new EventManager() )->platform_config();
			if ( ! $settings[ $platform . '_capi_enabled' ] || empty( $platforms[ $platform ]['enabled'] ) || ! ( new ConsentManager() )->allows_marketing( $decision ) || ! ( new ExclusionManager() )->should_track( $data->source_url ) ) {
				return $this->error( 403 );
			}
			$params = (array) apply_filters( 'pixelpair_event_params', $params, $data->event_name );
			$event  = new Event( $data->event_name, strtolower( $data->event_id ), time(), $data->source_url, $params, array_replace( ( new Collector() )->collect( $data->source_url, $platform ), $matching ) );
			$event  = apply_filters( 'pixelpair_event_before_dispatch', $event );
			if ( ! $event instanceof Event ) {
				return $this->error( 403 );
			}
			$result = ( new Queue() )->enqueue( $event, $platform );
			return is_wp_error( $result ) ? $result : array( 'accepted' => true );
		} finally {
			wp_set_current_user( $previous );
		}
	}
	/**
	 * Service operation.
	 *
	 * @param int $status HTTP status.
	 * @return \WP_Error
	 */
	private function error( int $status ): \WP_Error {
		return new \WP_Error( 'pixelpair_event_rejected', __( 'The event was not accepted.', 'pixelpair' ), array( 'status' => $status ) );
	}
}
