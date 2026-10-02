<?php
/**
 * Admin-only assets with generated WordPress dependency metadata.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Admin;

/** Load the WordPress-based admin application. */
final class Assets {
	/**
	 * Enqueue the application only for authorized users on its menu page.
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( 'toplevel_page_pixelpair' !== $hook_suffix || ! current_user_can( 'manage_pixelpair' ) ) {
			return;
		}
		$metadata = PIXELPAIR_PATH . 'build/admin.asset.php';
		if ( ! is_readable( $metadata ) ) {
			return;
		}
		/** Generated dependency metadata.
		 *
		 * @var array{dependencies: list<string>, version: string} $asset
		 */
		$asset = require $metadata;
		wp_enqueue_script( 'pixelpair-admin', plugins_url( 'build/admin.js', PIXELPAIR_FILE ), $asset['dependencies'], $asset['version'], true );
		$roles = array();
		foreach ( wp_roles()->roles as $slug => $role ) {
			$roles[] = array(
				'slug' => $slug,
				'name' => translate_user_role( $role['name'] ),
			);
		}
		wp_add_inline_script(
			'pixelpair-admin',
			'window.pixelpairAdmin = ' . wp_json_encode(
				array(
					'settingsUrl'    => rest_url( 'pixelpair/v1/settings' ),
					'siteUrl'        => home_url( '/' ),
					'logoUrl'        => plugins_url( 'assets/images/pixelpair-logo.svg', PIXELPAIR_FILE ),
					'version'        => PIXELPAIR_VERSION,
					'canScripts'     => \PixelPair\Scripts\Repository::allowed(),
					'canPermissions' => current_user_can( 'manage_options' ),
					'nonce'          => wp_create_nonce( 'wp_rest' ),
					'roles'          => $roles,
					'stores'         => array(
						'woocommerce' => class_exists( 'WooCommerce' ),
						'edd'         => function_exists( 'EDD' ),
					),
				),
				JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
			) . ';',
			'before'
		);
		wp_enqueue_style( 'pixelpair-admin', plugins_url( 'build/style-admin.css', PIXELPAIR_FILE ), array( 'wp-components' ), $asset['version'] );
		wp_set_script_translations( 'pixelpair-admin', 'pixelpair', PIXELPAIR_PATH . 'languages' );
	}
}
