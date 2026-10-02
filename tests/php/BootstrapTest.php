<?php
/** @package PixelPair */

use PHPUnit\Framework\TestCase;

final class BootstrapTest extends TestCase {
	public function test_plugin_bootstraps_without_generated_composer_files(): void {
		$root = dirname( __DIR__, 2 );
		$temporary = sys_get_temp_dir() . '/pixelpair-bootstrap-' . bin2hex( random_bytes( 8 ) );
		mkdir( $temporary );
		try {
			copy( $root . '/pixelpair.php', $temporary . '/pixelpair.php' );
			$files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root . '/src', FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::SELF_FIRST );
			foreach ( $files as $file ) {
				$target = $temporary . '/src' . substr( $file->getPathname(), strlen( $root . '/src' ) );
				if ( $file->isDir() ) {
					mkdir( $target, 0777, true );
				} else {
					if ( ! is_dir( dirname( $target ) ) ) {
						mkdir( dirname( $target ), 0777, true );
					}
					copy( $file->getPathname(), $target );
				}
			}
			$this->assertFileDoesNotExist( $temporary . '/vendor/autoload.php' );
			$command = escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( __DIR__ . '/fixtures/plugin-bootstrap.php' ) . ' ' . escapeshellarg( $temporary );
			exec( $command . ' 2>&1', $output, $code );
			$this->assertSame( 0, $code, implode( "\n", $output ) );
			$this->assertContains( 'PixelPair bootstrapped without vendor.', $output );
		} finally {
			$resolved = realpath( $temporary );
			if ( false === $resolved || dirname( $resolved ) !== realpath( sys_get_temp_dir() ) || 0 !== strpos( basename( $resolved ), 'pixelpair-bootstrap-' ) ) {
				throw new RuntimeException( 'Refusing cleanup outside the bootstrap test directory.' );
			}
			$files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $temporary, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
			foreach ( $files as $file ) {
				$file->isDir() ? rmdir( $file->getPathname() ) : unlink( $file->getPathname() );
			}
			rmdir( $temporary );
		}
	}

	public function test_entry_points_exit_silently_outside_wordpress(): void {
		foreach ( array( 'pixelpair.php', 'uninstall.php' ) as $file ) {
			$output = array();
			$code = 0;
			exec( escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( dirname( __DIR__, 2 ) . '/' . $file ), $output, $code );
			$this->assertSame( 0, $code );
			$this->assertSame( array(), $output );
		}
	}
}
