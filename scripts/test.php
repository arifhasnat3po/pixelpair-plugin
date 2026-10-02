<?php
/**
 * Execute integration tests in wp-env's disposable tests container.
 *
 * @package PixelPair
 */

if ( getenv( 'PIXELPAIR_TEST_WP_ROOT' ) ) {
	$command = escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( dirname( __DIR__ ) . '/vendor/phpunit/phpunit/phpunit' );
} else {
	$test_host = getenv( 'PIXELPAIR_TEST_HOST' ) ?: 'localhost:8889';
	$command = 'npx --no-install wp-env run tests-cli --env-cwd=wp-content/plugins/pixelpair env PIXELPAIR_TEST_WP_ROOT=/var/www/html ' . escapeshellarg( 'PIXELPAIR_TEST_HOST=' . $test_host ) . ' php vendor/phpunit/phpunit/phpunit';
}
$arguments = array_slice( $argv, 1 );
if ( ! in_array( '--group', $arguments, true ) ) {
	fwrite( STDOUT, "Base suite excludes optional store/MCP groups; run their documented supported fixtures separately.\n" );
	$arguments = array_merge( array( '--exclude-group', 'multisite,commerce,edd,mcp' ), $arguments );
}
foreach ( $arguments as $argument ) {
	$command .= ' ' . escapeshellarg( $argument );
}
passthru( $command, $status );
exit( $status );
