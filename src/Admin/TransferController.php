<?php
/**
 * Versioned configuration transfer without credentials or executable scripts.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Admin;

use PixelPair\Settings\Repository;
use PixelPair\Settings\Sanitizer;
use PixelPair\Events\Custom\Repository as Rules;
use PixelPair\Events\Custom\Validator;
/** Validate the entire portable document before committing any changes. */
final class TransferController {

	/** Register the portable resource. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/transfer',
			array(
				'methods'             => array( 'GET', 'POST' ),
				'permission_callback' => array( new SettingsController(), 'permissions' ),
				'callback'            => array( $this, 'handle' ),
			)
		);
	}
	/**
	 * Handle authorized transfer requests.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$result = $this->export();
		if ( 'POST' === $request->get_method() ) {
			$body   = $request->get_body();
			$data   = strlen( $body ) <= 524288 ? json_decode( $body, true ) : null;
			$result = is_array( $data ) ? $this->import( $data ) : self::error();
		}
		return is_wp_error( $result ) ? $result : new \WP_REST_Response( $result, 200, \PixelPair\Events\BootstrapController::headers() );
	}
	/**
	 * Export only portable, schema-validated fields.
	 *
	 * @return array<string,mixed>
	 */
	public function export(): array {
		$events = array();
		foreach ( ( new Rules() )->all() as $row ) {
			$rule = Validator::validate( $row );
			if ( ! is_wp_error( $rule ) ) {
				$events[] = $rule;
			}
		}
		return array(
			'format'   => 'pixelpair',
			'version'  => 1,
			'settings' => ( new Repository() )->get(),
			'events'   => $events,
		);
	}
	/**
	 * Replace settings and rules as one transaction under the rules lock.
	 *
	 * @param array<string,mixed> $data Complete portable document.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function import( array $data ) {
		if ( ! current_user_can( 'manage_pixelpair' ) ) {
			return self::error( 403 );
		}
		if ( count( $data ) !== 4 || ( $data['format'] ?? null ) !== 'pixelpair' || ( $data['version'] ?? null ) !== 1 || ! is_array( $data['settings'] ?? null ) || ! is_array( $data['events'] ?? null ) || array_values( $data['events'] ) !== $data['events'] || count( $data['events'] ) > 100 ) {
			return self::error();
		}
		$settings = Sanitizer::validate( $data['settings'] );
		if ( is_wp_error( $settings ) ) {
			return $settings;
		}
		$rules = array();
		foreach ( $data['events'] as $row ) {
			if ( ! is_array( $row ) ) {
				return self::error();
			}
			$rule = Validator::validate( $row );
			if ( is_wp_error( $rule ) ) {
				return $rule;
			}
			$rules[] = $rule;
		}
		return ( new Rules() )->replace_all( $rules, $settings );
	}
	/**
	 * Safe transfer error.
	 *
	 * @param int $status HTTP status.
	 * @return \WP_Error
	 */
	private static function error( int $status = 400 ): \WP_Error {
		return new \WP_Error( 'pixelpair_transfer_invalid', __( 'Import rejected. Use a PixelPair version 1 export with valid settings and at most 100 events. No changes were saved.', 'pixelpair' ), array( 'status' => $status ) );
	}
}
