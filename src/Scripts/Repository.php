<?php
/**
 * Privileged script storage, separate from portable settings.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Scripts;

/**
 * Preserve authorized raw markup without exposing it to ordinary managers.
 */
final class Repository {

	/**
	 * Apply the validated configuration.
	 *
	 * @return array<string,array<string,string>> Empty slots.
	 */
	public static function defaults(): array {
		return array_fill_keys(
			array( 'head', 'body', 'footer', 'receipt' ),
			array(
				'code'    => '',
				'device'  => 'all',
				'consent' => 'marketing',
			)
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @return bool Current actor may manage executable markup.
	 */
	public static function allowed(): bool {
		return current_user_can( 'manage_pixelpair' ) && current_user_can( 'unfiltered_html' );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param mixed $value Proposed complete scripts.
	 * @return bool Valid schema.
	 */
	public static function valid( $value ): bool {
		$defaults = self::defaults();
		if ( ! is_array( $value ) || array_diff_key( $value, $defaults ) || array_diff_key( $defaults, $value ) ) {
			return false;
		}
		foreach ( $value as $row ) {
			if ( ! is_array( $row ) || count( $row ) !== 3 || ! isset( $row['code'], $row['device'], $row['consent'] ) || ! is_string( $row['code'] ) || strlen( $row['code'] ) > 32768 || ! in_array( $row['device'], array( 'all', 'desktop', 'mobile' ), true ) || ! in_array( $row['consent'], array( 'marketing', 'statistics' ), true ) ) {
				return false;
			}
		}
		return true;
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @return array<string,array<string,string>> Valid stored scripts.
	 */
	public function get(): array {
		$value = get_option( 'pixelpair_scripts', self::defaults() );
		return self::valid( $value ) ? $value : self::defaults();
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param array<string,mixed> $value Scripts.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function save( array $value ) {
		if ( ! self::allowed() ) {
			return self::error( 403 );
		}
		if ( ! self::valid( $value ) ) {
			return self::error( 400 );
		}
		update_option( 'pixelpair_scripts', $value, true );
		return get_option( 'pixelpair_scripts' ) === $value ? $value : self::error( 500 );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int                 $post_id Post.
	 * @param array<string,mixed> $value Override.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function save_post( int $post_id, array $value ) {
		if ( ! self::allowed() || ! current_user_can( 'edit_post', $post_id ) ) {
			return self::error( 403 );
		}
		if ( count( $value ) !== 2 || ! isset( $value['mode'], $value['scripts'] ) || ! in_array( $value['mode'], array( 'inherit', 'append', 'replace', 'disable' ), true ) || ! self::valid( $value['scripts'] ) ) {
			return self::error( 400 );
		}
		update_post_meta( $post_id, '_pixelpair_scripts', $value );
		return get_post_meta( $post_id, '_pixelpair_scripts', true ) === $value ? $value : self::error( 500 );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int $status HTTP status.
	 * @return \WP_Error Safe error.
	 */
	private static function error( int $status ): \WP_Error {
		return new \WP_Error( 'pixelpair_scripts_rejected', __( 'Scripts were not saved. Check your permissions, targeting and the 32 KB limit per slot.', 'pixelpair' ), array( 'status' => $status ) );
	}
}
