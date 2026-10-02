<?php
/**
 * Privileged post script overrides.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Scripts;

/**
 * Nonce and edit permission are checked independently of global script access.
 */
final class MetaBox {

	/**
	 * Register editor integration.
	 */
	public function register(): void {
		add_action( 'add_meta_boxes', array( $this, 'add' ) );
		add_action( 'save_post', array( $this, 'save' ) );
		add_action(
			'admin_notices',
			static function (): void {
            // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only status flag, no state change.
				if ( Repository::allowed() && isset( $_GET['pixelpair_script_error'] ) ) {
					echo '<div class="notice notice-error"><p>' . esc_html__( 'PixelPair page scripts were not saved. Check the script size and targeting fields.', 'pixelpair' ) . '</p></div>';
				}
			}
		);
	}
	/**
	 * Show only to actors allowed to store raw markup.
	 */
	public function add(): void {
		if ( Repository::allowed() ) {
			add_meta_box( 'pixelpair-scripts', __( 'PixelPair scripts', 'pixelpair' ), array( $this, 'render' ), array( 'post', 'page', 'product', 'download' ), 'normal' );
		}
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \WP_Post $post Edited post.
	 */
	public function render( \WP_Post $post ): void {
		if ( ! Repository::allowed() || ! current_user_can( 'edit_post', $post->ID ) ) {
			return;
		}
		$value   = \PixelPair\Settings\Migrations::meta( 'post', $post->ID, '_pixelpair_scripts' );
		$scripts = is_array( $value ) && Repository::valid( $value['scripts'] ?? null ) ? $value['scripts'] : Repository::defaults();
		$mode    = is_array( $value ) ? $value['mode'] ?? 'inherit' : 'inherit';
		wp_nonce_field( 'pixelpair_post_scripts', 'pixelpair_scripts_nonce' );
		echo '<p><label for="pixelpair-script-mode">' . esc_html__( 'Page script mode', 'pixelpair' ) . '</label> <select id="pixelpair-script-mode" name="pixelpair_script_mode">';
		foreach ( array(
			'inherit' => __( 'Use global scripts', 'pixelpair' ),
			'append'  => __( 'Global and page scripts', 'pixelpair' ),
			'replace' => __( 'Page scripts only', 'pixelpair' ),
			'disable' => __( 'Disable scripts on this page', 'pixelpair' ),
		) as $key => $label ) {
			echo '<option value="' . esc_attr( $key ) . '" ' . selected( $mode, $key, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select></p>';
		foreach ( array(
			'head'   => __( 'Head', 'pixelpair' ),
			'body'   => __( 'After body opens', 'pixelpair' ),
			'footer' => __( 'Footer', 'pixelpair' ),
		) as $slot => $label ) {
			echo '<p><label for="pixelpair-code-' . esc_attr( $slot ) . '">' . esc_html( $label ) . '</label><textarea class="widefat code" rows="5" id="pixelpair-code-' . esc_attr( $slot ) . '" name="pixelpair_page_scripts[' . esc_attr( $slot ) . '][code]">' . esc_textarea( $scripts[ $slot ]['code'] ) . '</textarea></p>';
			foreach ( array(
				'device'  => array(
					'all'     => __( 'All devices', 'pixelpair' ),
					'desktop' => __( 'Desktop', 'pixelpair' ),
					'mobile'  => __( 'Mobile', 'pixelpair' ),
				),
				'consent' => array(
					'marketing'  => __( 'Marketing consent', 'pixelpair' ),
					'statistics' => __( 'Statistics consent', 'pixelpair' ),
				),
			) as $field => $options ) {
				echo '<label>' . esc_html( $label ) . ' <select name="pixelpair_page_scripts[' . esc_attr( $slot ) . '][' . esc_attr( $field ) . ']">';
				foreach ( $options as $key => $text ) {
					echo '<option value="' . esc_attr( $key ) . '" ' . selected( $scripts[ $slot ][ $field ], $key, false ) . '>' . esc_html( $text ) . '</option>';
				}
				echo '</select></label> ';
			}
		}
		echo '<p>' . esc_html__( 'Scripts run after the selected consent category is granted. Each slot allows up to 32 KB.', 'pixelpair' ) . '</p>';
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int $post_id Saved post.
	 */
	public function save( int $post_id ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) || ! Repository::allowed() || ! current_user_can( 'edit_post', $post_id ) || ! isset( $_POST['pixelpair_scripts_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['pixelpair_scripts_nonce'] ) ), 'pixelpair_post_scripts' ) ) {
			return;
		}
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Authorized unfiltered_html content is stored raw; the complete slot schema is validated by Repository.
		$raw    = isset( $_POST['pixelpair_page_scripts'] ) ? wp_unslash( $_POST['pixelpair_page_scripts'] ) : array();
		$mode   = isset( $_POST['pixelpair_script_mode'] ) ? sanitize_key( wp_unslash( $_POST['pixelpair_script_mode'] ) ) : 'inherit';
		$result = ( new Repository() )->save_post(
			$post_id,
			array(
				'mode'    => $mode,
				'scripts' => is_array( $raw ) ? array_replace( Repository::defaults(), $raw ) : array(),
			)
		);
		if ( is_wp_error( $result ) ) {
			add_filter(
				'redirect_post_location',
				static function ( string $url ): string {
					return add_query_arg( 'pixelpair_script_error', '1', $url );
				}
			);
		}
	}
}
