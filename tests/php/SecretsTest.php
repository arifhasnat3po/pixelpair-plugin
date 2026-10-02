<?php
/** @package PixelPair */
use PixelPair\Support\Crypto;
use PixelPair\Settings\Secrets;

final class SecretsTest extends LifecycleTestCase {
	protected function tearDown(): void {
		delete_option( 'pixelpair_secrets' );
		parent::tearDown();
	}
	public function test_authenticated_encryption_randomizes_and_rejects_tampering(): void {
		$this->assertTrue( class_exists( Crypto::class ), 'Authenticated encryption is missing.' );
		$a = Crypto::encrypt( 'private-test-value' );
		$b = Crypto::encrypt( 'private-test-value' );
		$this->assertNotSame( $a, $b );
		$this->assertStringNotContainsString( 'private-test-value', $a );
		$this->assertSame( 'private-test-value', Crypto::decrypt( $a ) );
		$this->assertNull( Crypto::decrypt( substr( $a, 0, -8 ) . 'AAAAAAAA' ) );
		$this->assertNull( Crypto::decrypt( 'malformed' ) );
	}
	public function test_credentials_are_encrypted_nonautoloaded_masked_and_removable(): void {
		$this->assertTrue( class_exists( Secrets::class ), 'Secret store is missing.' );
		$store = new Secrets();
		$result = $store->update( array( 'token' => 'EAAtest_secret_12345', 'test_code' => 'TEST123' ) );
		$this->assertTrue( $result['token_set'] );
		$this->assertSame( '••••••••', $result['token_mask'] );
		$this->assertSame( 'EAAtest_secret_12345', $store->token() );
		$this->assertStringNotContainsString( 'EAAtest_secret_12345', wp_json_encode( get_option( 'pixelpair_secrets' ) ) );
		$this->assertArrayNotHasKey( 'pixelpair_secrets', wp_load_alloptions() );
		$this->assertSame( 'TEST123', $store->test_code() );
		$raw = get_option( 'pixelpair_secrets' );
		$raw['test_until'] = time() - 1;
		update_option( 'pixelpair_secrets', $raw, false );
		$this->assertSame( '', $store->test_code() );
		$this->assertFalse( $store->status()['test_active'] );
		$this->assertFalse( $store->update( array( 'remove_token' => true ) )['token_set'] );
	}
	public function test_invalid_secret_changes_are_atomic_and_storage_failure_is_reported(): void {
		$this->assertTrue( class_exists( Secrets::class ), 'Secret store is missing.' );
		$store = new Secrets();
		$store->update( array( 'token' => 'EAAtest_secret_12345' ) );
		$before = get_option( 'pixelpair_secrets' );
		$this->assertInstanceOf( WP_Error::class, $store->update( array( 'token' => '<script>', 'test_code' => 'GOOD' ) ) );
		$this->assertSame( $before, get_option( 'pixelpair_secrets' ) );
		$reject = static function ( $new, $old ) { return $old; };
		add_filter( 'pre_update_option_pixelpair_secrets', $reject, 10, 2 );
		try { $this->assertInstanceOf( WP_Error::class, $store->update( array( 'remove_token' => true ) ) ); }
		finally { remove_filter( 'pre_update_option_pixelpair_secrets', $reject ); }
	}
}
