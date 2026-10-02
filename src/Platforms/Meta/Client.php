<?php
/**
 * Bounded transport to Meta's fixed API host.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\Meta;

use PixelPair\Settings\Repository;
use PixelPair\Settings\Secrets;

/** Never retain token-bearing requests or arbitrary response text in diagnostics. */
final class Client {
	/**
	 * Service operation.
	 *
	 * @param array<string, mixed> $event Verified Meta event.
	 * @return array<string, mixed>
	 */
	public function send( array $event ): array {
		$settings = ( new Repository() )->get();
		$secrets  = new Secrets();
		if ( ! $settings['meta_enabled'] || ! $settings['meta_capi_enabled'] || '' === $secrets->token() || empty( $event ) ) {
			return array(
				'success'  => false,
				'retry'    => false,
				'code'     => 0,
				'response' => array( 'error' => 'not_configured' ),
			);
		}
		$body = array(
			'data'         => array( $event ),
			'access_token' => $secrets->token(),
		);
		$test = $secrets->test_code();
		if ( '' !== $test ) {
			$body['test_event_code'] = $test;
		}
		$response = wp_remote_post(
			'https://graph.facebook.com/' . Config::GRAPH_VERSION . '/' . $settings['meta_pixel_id'] . '/events',
			array(
				'timeout'             => 15,
				'redirection'         => 0,
				'sslverify'           => true,
				'headers'             => array( 'Content-Type' => 'application/json' ),
				'body'                => wp_json_encode( $body ),
				'limit_response_size' => 16384,
			)
		);
		if ( is_wp_error( $response ) ) {
			return array(
				'success'  => false,
				'retry'    => true,
				'code'     => 0,
				'response' => array( 'error' => 'transport_failed' ),
			);
		}
		$code     = (int) wp_remote_retrieve_response_code( $response );
		$data     = json_decode( wp_remote_retrieve_body( $response ), true );
		$error    = is_array( $data ) && is_array( $data['error'] ?? null ) ? $data['error'] : array();
		$success  = $code >= 200 && $code < 300 && is_array( $data ) && empty( $error ) && ( $data['events_received'] ?? 0 ) >= 1;
		$redacted = $success ? array( 'events_received' => (int) $data['events_received'] ) : array( 'error_code' => (int) ( $error['code'] ?? 0 ) );
		return array(
			'success'  => $success,
			'retry'    => ! $success && ( $code >= 500 || 429 === $code || true === ( $error['is_transient'] ?? false ) ),
			'code'     => $code,
			'response' => $redacted,
		);
	}
}
