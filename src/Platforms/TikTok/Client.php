<?php
/**
 * Fixed-host bounded Events API transport.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Platforms\TikTok;

use PixelPair\Settings\{Repository, Secrets};
/**
 * Redact all vendor response text, headers and credentials.
 */
final class Client {

	/**
	 * Apply the validated configuration.
	 *
	 * @param array<string,mixed> $event Verified event.
	 * @return array<string,mixed>
	 */
	public function send( array $event ): array {
		$s       = ( new Repository() )->get();
		$secrets = new Secrets( 'tiktok' );
		if ( ! $s['tiktok_enabled'] || ! $s['tiktok_capi_enabled'] || ! $secrets->token() || ! $event ) {
			return array(
				'success'  => false,
				'retry'    => false,
				'code'     => 0,
				'response' => array( 'error' => 'not_configured' ),
			);
		}
		$body = array(
			'event_source'    => 'web',
			'event_source_id' => $s['tiktok_pixel_id'],
			'data'            => array( $event ),
		);
		if ( $secrets->test_code() ) {
			$body['test_event_code'] = $secrets->test_code();
		}
		$r = wp_remote_post(
			Config::API_URL,
			array(
				'timeout'             => 15,
				'redirection'         => 0,
				'sslverify'           => true,
				'limit_response_size' => 16384,
				'headers'             => array(
					'Content-Type' => 'application/json',
					'Access-Token' => $secrets->token(),
				),
				'body'                => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $r ) ) {
			return array(
				'success'  => false,
				'retry'    => true,
				'code'     => 0,
				'response' => array( 'error' => 'transport_failed' ),
			);
		}
		$code    = (int) wp_remote_retrieve_response_code( $r );
		$data    = json_decode( wp_remote_retrieve_body( $r ), true );
		$success = $code >= 200 && $code < 300 && is_array( $data ) && isset( $data['code'] ) && 0 === $data['code'];
		return array(
			'success'  => $success,
			'retry'    => ! $success && ( $code >= 500 || 429 === $code ),
			'code'     => $code,
			'response' => $success ? array( 'events_received' => 1 ) : array( 'error_code' => (int) ( $data['code'] ?? -1 ) ),
		);
	}
}
