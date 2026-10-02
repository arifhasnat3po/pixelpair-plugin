<?php
/**
 * Authenticated encryption for credentials and queued matching data.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Support;

/** Bind ciphertext to this site's WordPress keys. */
final class Crypto {
	/**
	 * Service operation.
	 *
	 * @param string $plain Sensitive plaintext.
	 * @return string
	 * @throws \RuntimeException When authenticated encryption fails.
	 */
	public static function encrypt( string $plain ): string {
		$iv     = random_bytes( 12 );
		$tag    = '';
		$cipher = openssl_encrypt( $plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag, self::context() );
		if ( false === $cipher ) {
			throw new \RuntimeException( 'PixelPair encryption failed.' );
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Encode encrypted binary data for safe storage, never executable code.
		return 'v2:' . base64_encode( $iv . $tag . $cipher );
	}
	/**
	 * Service operation.
	 *
	 * @param string $value Ciphertext.
	 * @return string|null
	 */
	public static function decrypt( string $value ): ?string {
		if ( 0 === strpos( $value, 'v1:' ) ) {
			return \PixelPair\Settings\Migrations::decrypt_legacy( $value );
		}
		if ( 0 !== strpos( $value, 'v2:' ) ) {
			return null;
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Decode authenticated ciphertext only.
		$data = base64_decode( substr( $value, 3 ), true );
		if ( false === $data || strlen( $data ) < 28 ) {
			return null;
		}
		$plain = openssl_decrypt( substr( $data, 28 ), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr( $data, 0, 12 ), substr( $data, 12, 16 ), self::context() );
		return false === $plain ? null : $plain;
	}
	/**
	 * Service operation.
	 *
	 * @return string
	 */
	private static function context(): string {
		return 'pixelpair:' . get_current_blog_id();
	}
	/**
	 * Service operation.
	 *
	 * @return string
	 */
	private static function key(): string {
		return hash( 'sha256', (string) constant( 'AUTH_KEY' ) . (string) constant( 'SECURE_AUTH_SALT' ) . self::context(), true );
	}
}
