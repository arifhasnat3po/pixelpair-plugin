<?php
/** @package PixelPair */

use PixelPair\Activation;

final class SettingsControllerTest extends LifecycleTestCase {
	/** @var WP_REST_Server */
	private $server;

	protected function setUp(): void {
		parent::setUp();
		Activation::activate( false );
		$this->server = rest_get_server();
	}

	private function request( string $method, array $body = array(), ?string $nonce = null ): WP_REST_Response {
		$request = new WP_REST_Request( $method, '/pixelpair/v1/settings' );
		$request->set_header( 'Content-Type', 'application/json' );
		if ( null !== $nonce ) {
			$request->set_header( 'X-WP-Nonce', $nonce );
		}
		if ( 'POST' === $method ) {
			$request->set_body( wp_json_encode( $body ) );
		}
		return $this->server->dispatch( $request );
	}

	private function sign_in( string $role = 'administrator' ): void {
		$user = get_users( array( 'role' => $role, 'number' => 1 ) )[0];
		wp_set_current_user( $user->ID );
	}

	public function test_capability_and_nonce_are_required_for_reads_and_writes(): void {
		$this->sign_in();
		$this->assertSame( 403, $this->request( 'GET' )->get_status() );
		$this->assertSame( 403, $this->request( 'POST', array( 'meta_enabled' => false ), 'invalid' )->get_status() );
		$this->sign_in( 'subscriber' );
		$this->assertSame( 403, $this->request( 'GET', array(), wp_create_nonce( 'wp_rest' ) )->get_status() );
		wp_set_current_user( 0 );
		$this->assertSame( 403, $this->request( 'POST', array(), wp_create_nonce( 'wp_rest' ) )->get_status() );
	}

	public function test_authorized_save_and_reload_and_atomic_rejection(): void {
		$this->sign_in();
		$nonce = wp_create_nonce( 'wp_rest' );
		$response = $this->request( 'POST', array( 'meta_pixel_id' => '123456789012345', 'meta_enabled' => true ), $nonce );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$this->assertSame( $response->get_data(), $this->request( 'GET', array(), $nonce )->get_data() );
		$before = get_option( 'pixelpair_settings' );
		$this->assertSame( 400, $this->request( 'POST', array( 'meta_pixel_id' => 123456789012345, 'strict_cache_mode' => true ), $nonce )->get_status() );
		$this->assertSame( $before, get_option( 'pixelpair_settings' ) );
		$this->assertSame( 400, $this->request( 'POST', array( 'future_secret' => 'no' ), $nonce )->get_status() );
	}

	public function test_endpoint_rejects_malformed_json_and_non_object_bodies(): void {
		$this->sign_in();
		foreach ( array( '{broken', '[]', '"text"', 'null' ) as $body ) {
			$request = new WP_REST_Request( 'POST', '/pixelpair/v1/settings' );
			$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
			$request->set_header( 'Content-Type', 'application/json' );
			$request->set_body( $body );
			$this->assertSame( 400, $this->server->dispatch( $request )->get_status() );
		}
	}

	public function test_rest_response_excludes_unknown_stored_secrets(): void {
		$this->sign_in();
		update_option( 'pixelpair_settings', array( 'future_secret' => 'never-return' ) );
		$response = $this->request( 'GET', array(), wp_create_nonce( 'wp_rest' ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertArrayNotHasKey( 'future_secret', $response->get_data() );
		$this->assertStringContainsString( 'no-store', $response->get_headers()['Cache-Control'] );
	}

	public function test_failed_persistence_returns_server_error_without_claiming_tracking_was_disabled(): void {
		$this->sign_in();
		$nonce = wp_create_nonce( 'wp_rest' );
		$this->request( 'POST', array( 'meta_pixel_id' => '123456789012345', 'meta_enabled' => true ), $nonce );
		$before = get_option( 'pixelpair_settings' );
		$reject = static function ( $new_value, $old_value ) { return $old_value; };
		add_filter( 'pre_update_option_pixelpair_settings', $reject, 10, 2 );
		try {
			$response = $this->request( 'POST', array( 'meta_enabled' => false ), $nonce );
			$this->assertSame( 500, $response->get_status() );
			$this->assertSame( 'pixelpair_save_failed', $response->get_data()['code'] );
			$this->assertSame( $before, get_option( 'pixelpair_settings' ) );
		} finally {
			remove_filter( 'pre_update_option_pixelpair_settings', $reject );
		}
	}
}
