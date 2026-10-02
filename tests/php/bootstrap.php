<?php
/**
 * Integration tests run against a disposable wp-env installation, never production.
 *
 * @package PixelPair
 */

$pixelpair_test_root = getenv( 'PIXELPAIR_TEST_WP_ROOT' );
if ( ! $pixelpair_test_root || ! is_file( $pixelpair_test_root . '/wp-load.php' ) ) {
	throw new RuntimeException( 'Set PIXELPAIR_TEST_WP_ROOT to a disposable, installed WordPress test site.' );
}

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';
$_SERVER['HTTP_HOST'] = getenv( 'PIXELPAIR_TEST_HOST' ) ?: 'localhost';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$pixelpair_bootstrapped = false;
register_shutdown_function(
	static function () use ( &$pixelpair_bootstrapped ): void {
		if ( ! $pixelpair_bootstrapped ) {
			fwrite( STDERR, "WordPress exited before the test suite started. Check the disposable site's host/configuration.\n" );
			exit( 1 );
		}
	}
);
require $pixelpair_test_root . '/wp-load.php';
$pixelpair_bootstrapped = true;
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once __DIR__ . '/LifecycleTestCase.php';
