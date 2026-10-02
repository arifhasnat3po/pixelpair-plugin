<?php
/** Fail CI if the debug log contains a PixelPair PHP diagnostic. @package PixelPair */
$path = $argv[1] ?? '';
if ( ! is_file( $path ) ) {
	echo "No WordPress debug log was produced.\n";
	exit( 0 );
}
$lines = file( $path );
$failed = false;
foreach ( $lines as $line ) {
	if ( preg_match( '~PHP (?:Warning|Deprecated|Notice|Fatal error|Parse error).*/pixelpair/~i', str_replace( '\\', '/', $line ) ) ) {
		fwrite( STDERR, $line );
		$failed = true;
	}
}
exit( $failed ? 1 : 0 );
