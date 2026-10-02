<?php
/**
 * Nonautoloaded credentials never exposed through public settings.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Settings;

use PixelPair\Support\Crypto;

/** Store credentials separately from cacheable settings. */
final class Secrets {
	/**
	 * Fixed per-platform option name.
	 *
	 * @var string
	 */
	private $option;
	/**
	 * Select an isolated fixed credential store.
	 *
	 * @param string $platform Fixed platform selector.
	 */
	public function __construct( string $platform = 'meta' ) {
		$this->option = 'tiktok' === $platform ? 'pixelpair_tiktok_secrets' : 'pixelpair_secrets';
	}
	/**
	 * Service operation.
	 *
	 * @return string
	 */
	public function token(): string {
		$stored = get_option( $this->option, array() );
		return is_array( $stored ) && is_string( $stored['token'] ?? null ) ? ( Crypto::decrypt( $stored['token'] ) ?? '' ) : '';
	}
	/**
	 * Service operation.
	 *
	 * @return string
	 */
	public function test_code(): string {
		$stored = get_option( $this->option, array() );
		return is_array( $stored ) && ( $stored['test_until'] ?? 0 ) > time() && is_string( $stored['test_code'] ?? null ) ? $stored['test_code'] : '';
	}
	/**
	 * Service operation.
	 *
	 * @return array<string, mixed>
	 */
	public function status(): array {
		$set = '' !== $this->token();
		return array(
			'token_set'   => $set,
			'token_mask'  => $set ? '••••••••' : '',
			'test_active' => '' !== $this->test_code(),
			'test_code'   => $this->test_code(),
		);
	}
	/**
	 * Service operation.
	 *
	 * @param array<string, mixed> $changes Raw credential changes.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function update( array $changes ) {
		if ( array_diff( array_keys( $changes ), array( 'token', 'remove_token', 'test_code' ) ) || ( isset( $changes['token'] ) && ( ! is_string( $changes['token'] ) || ! preg_match( '/\A[A-Za-z0-9_.|\-]{10,4096}\z/', $changes['token'] ) ) ) || ( array_key_exists( 'remove_token', $changes ) && ! is_bool( $changes['remove_token'] ) ) || ( array_key_exists( 'test_code', $changes ) && ( ! is_string( $changes['test_code'] ) || ! preg_match( '/\A[A-Za-z0-9_\-]{0,100}\z/', $changes['test_code'] ) ) ) || ( array_key_exists( 'token', $changes ) && null === $changes['token'] ) ) {
			return new \WP_Error( 'pixelpair_invalid_credentials', __( 'Enter a valid token and test event code.', 'pixelpair' ), array( 'status' => 400 ) );
		}
		$stored = get_option( $this->option, array() );
		$next   = is_array( $stored ) ? $stored : array();
		try {
			if ( isset( $changes['token'] ) ) {
				$next['token'] = Crypto::encrypt( $changes['token'] );
			}
		} catch ( \Throwable $error ) {
			return new \WP_Error( 'pixelpair_crypto_failed', __( 'Encryption is unavailable. Credentials were not saved.', 'pixelpair' ), array( 'status' => 500 ) );
		}
		if ( ! empty( $changes['remove_token'] ) ) {
			unset( $next['token'] );
		}
		if ( isset( $changes['test_code'] ) ) {
			$next['test_code']  = $changes['test_code'];
			$next['test_until'] = time() + DAY_IN_SECONDS;
		}
		update_option( $this->option, $next, false );
		if ( get_option( $this->option ) !== $next ) {
			return new \WP_Error( 'pixelpair_save_failed', __( 'Credentials could not be saved. Please try again.', 'pixelpair' ), array( 'status' => 500 ) );
		}
		return $this->status();
	}
}
