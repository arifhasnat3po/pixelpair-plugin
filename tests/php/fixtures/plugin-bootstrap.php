<?php
/** Isolated process: WordPress APIs, no test-runner or plugin Composer loader. */

$pixelpair_isolated_root = $argv[1];
define( 'WP_DISABLE_FATAL_ERROR_HANDLER', true );
$wp_root = getenv( 'PIXELPAIR_TEST_WP_ROOT' );
$_SERVER['HTTP_HOST'] = getenv( 'PIXELPAIR_TEST_HOST' ) ?: 'localhost';
$_SERVER['REQUEST_URI'] = '/';
foreach ( array( 'pre_option_active_plugins', 'pre_site_option_active_sitewide_plugins' ) as $filter ) {
	$GLOBALS['wp_filter'][ $filter ][10][] = array( 'function' => static function () { return array(); }, 'accepted_args' => 0 );
}
require $wp_root . '/wp-load.php';
ini_set( 'display_errors', '1' );
if ( class_exists( 'PixelPair\\Plugin', false ) || defined( 'PIXELPAIR_FILE' ) ) {
	throw new RuntimeException( 'Test isolation failed: PixelPair was already loaded.' );
}
require $pixelpair_isolated_root . '/pixelpair.php';
if ( ! class_exists( 'PixelPair\\Plugin' ) ) {
	throw new RuntimeException( 'PixelPair cannot boot without generated Composer files.' );
}
do_action( 'plugins_loaded' );
$routes = rest_get_server()->get_routes();
if ( ! isset( $routes['/pixelpair/v1/settings'], $routes['/pixelpair/v1/events'] ) ) {
	throw new RuntimeException( 'PixelPair settings/events services were not registered.' );
}
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $pixelpair_isolated_root . '/src', FilesystemIterator::SKIP_DOTS ) ) as $file ) {
	if ( 'php' !== $file->getExtension() ) {
		continue;
	}
	$class = 'PixelPair\\' . str_replace( array( '/', '\\' ), '\\', substr( $file->getPathname(), strlen( $pixelpair_isolated_root . '/src/' ), -4 ) );
	if ( ! class_exists( $class ) && ! interface_exists( $class ) ) {
		throw new RuntimeException( 'Could not load shipped class: ' . $class );
	}
	if ( realpath( ( new ReflectionClass( $class ) )->getFileName() ) !== realpath( $file->getPathname() ) ) {
		throw new RuntimeException( 'Class loaded from another copy: ' . $class );
	}
}
file_put_contents( $pixelpair_isolated_root . '/outside.php', '<?php throw new RuntimeException("Autoloader escaped its namespace or source directory.");' );
foreach ( spl_autoload_functions() as $loader ) {
	$loader( 'OtherPlugin\\outside' );
	$loader( 'PixelPair\\..\\outside' );
	$loader( 'PixelPair\\../outside' );
	$loader( 'PixelPair\\MissingClass' );
}
echo "PixelPair bootstrapped without vendor.\n";
