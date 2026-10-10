<?php
/**
 * Capability-restricted admin entry point.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Admin;

/** Own the restricted PixelPair menu. */
final class Menu {
	/** Add one top-level menu for the site-scoped app. */
	public function register(): void {
		add_menu_page( __( 'PixelPair – Marketing Tracking', 'pixelpair' ), __( 'PixelPair', 'pixelpair' ), 'manage_pixelpair', 'pixelpair', array( $this, 'render' ), self::icon() );
		add_submenu_page( 'pixelpair', __( 'Overview', 'pixelpair' ), __( 'Overview', 'pixelpair' ), 'manage_pixelpair', 'pixelpair', array( $this, 'render' ) );
		$routes = array(
			'connections' => __( 'Connections', 'pixelpair' ),
			'events'      => __( 'Events', 'pixelpair' ),
		);
		if ( class_exists( 'WooCommerce' ) || function_exists( 'EDD' ) ) {
			$routes['store'] = __( 'Store', 'pixelpair' );
		}
		$routes['privacy']  = __( 'Privacy', 'pixelpair' );
		$routes['activity'] = __( 'Activity', 'pixelpair' );
		$routes['settings'] = __( 'Settings', 'pixelpair' );
		foreach ( $routes as $route => $label ) {
			add_submenu_page( 'pixelpair', $label, $label, 'manage_pixelpair', 'admin.php?page=pixelpair#/' . $route );
		}
	}

	/** Return the local monochrome mark in WordPress's recolorable data-URI format. */
	public static function icon(): string {
		$file = PIXELPAIR_PATH . 'assets/images/pixelpair-mark-mono.svg';
		if ( ! is_readable( $file ) ) {
			return 'dashicons-chart-area';
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Bundled local asset, never a remote request.
		$svg = (string) file_get_contents( $file );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Required by WordPress menu SVG recoloring.
		return 'data:image/svg+xml;base64,' . base64_encode( str_replace( 'currentColor', 'black', $svg ) );
	}

	/** Credit the author only on this plugin's admin screen.
	 *
	 * @param string $text Existing WordPress footer.
	 */
	public function footer( string $text ): string {
		$screen = get_current_screen();
		if ( ! $screen || 'toplevel_page_pixelpair' !== $screen->id ) {
			return $text;
		}
		return sprintf(
			/* translators: %1$s: linked plugin author. */
			esc_html__( 'PixelPair, built by %1$s', 'pixelpair' ),
			'<a href="https://github.com/arifhasnat3po">Arif Hasnat</a>'
		);
	}

	/** Render the accessible root after independently checking the capability. */
	public function render(): void {
		if ( ! current_user_can( 'manage_pixelpair' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage PixelPair.', 'pixelpair' ), '', array( 'response' => 403 ) );
		}
		if ( ! is_readable( PIXELPAIR_PATH . 'build/admin.asset.php' ) ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'PixelPair admin assets are missing. Install a built plugin package or run npm ci and npm run build.', 'pixelpair' ) . '</p></div>';
		}
		echo '<div class="wrap" id="pixelpair-admin" role="region" aria-label="' . esc_attr__( 'PixelPair settings', 'pixelpair' ) . '"></div>';
	}
}
