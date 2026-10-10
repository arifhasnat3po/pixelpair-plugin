<?php
/**
 * Plugin Name: Arif PixelPair – Marketing Tracking
 * Plugin URI: https://github.com/arifhasnat3po/pixelpair-plugin
 * Description: Configure marketing pixels and conversion APIs from WordPress.
 * Version: 0.9.2
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: Arif Hasnat
 * Author URI: https://github.com/arifhasnat3po
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: pixelpair
 * Domain Path: /languages
 *
 * Copyright (C) 2026 Arif Hasnat
 *
 * @package PixelPair
 */

defined( 'ABSPATH' ) || exit;

define( 'PIXELPAIR_VERSION', '0.9.2' );
define( 'PIXELPAIR_FILE', __FILE__ );
define( 'PIXELPAIR_PATH', __DIR__ . '/' );

if ( is_readable( PIXELPAIR_PATH . 'vendor/autoload.php' ) ) {
	require_once PIXELPAIR_PATH . 'vendor/autoload.php';
} else {
	// No third-party PHP runtime packages: recover our own classes if vendor was omitted.
	spl_autoload_register(
		static function ( string $class_name ): void {
			if ( 0 !== strpos( $class_name, 'PixelPair\\' ) ) {
				return;
			}
			$relative = str_replace( '\\', '/', substr( $class_name, strlen( 'PixelPair\\' ) ) );
			if ( ! preg_match( '/\A[A-Za-z_][A-Za-z0-9_]*(?:\/[A-Za-z_][A-Za-z0-9_]*)*\z/', $relative ) ) {
				return;
			}
			$file = PIXELPAIR_PATH . 'src/' . $relative . '.php';
			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	);
}

register_activation_hook( __FILE__, array( \PixelPair\Activation::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \PixelPair\Deactivation::class, 'deactivate' ) );

add_action(
	'plugins_loaded',
	static function (): void {
		( new \PixelPair\Plugin() )->register();
	}
);
