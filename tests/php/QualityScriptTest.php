<?php
/** @package PixelPair */

use PHPUnit\Framework\TestCase;

final class QualityScriptTest extends TestCase {
	/** @dataProvider debug_lines */
	public function test_debug_log_check_rejects_plugin_diagnostics( string $line, int $expected ): void {
		$log = tempnam( sys_get_temp_dir(), 'pixelpair-log-' );
		try {
			file_put_contents( $log, $line . PHP_EOL );
			$command = escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( dirname( __DIR__, 2 ) . '/scripts/check-debug-log.php' ) . ' ' . escapeshellarg( $log );
			exec( $command . ' 2>&1', $output, $status );
			$this->assertSame( $expected, $status, implode( "\n", $output ) );
			$this->assertStringNotContainsString( 'preg_match()', implode( "\n", $output ) );
		} finally {
			unlink( $log );
		}
	}

	public static function debug_lines(): array {
		return array(
			'Unix warning' => array( '[date] PHP Warning: test in /var/www/html/wp-content/plugins/pixelpair/src/Plugin.php on line 1', 1 ),
			'Windows deprecation' => array( '[date] PHP Deprecated: test in C:\\site\\plugins\\pixelpair\\src\\Plugin.php on line 1', 1 ),
			'Other plugin' => array( '[date] PHP Warning: test in /plugins/another-plugin/file.php on line 1', 0 ),
			'Ordinary message' => array( '[date] PixelPair test completed', 0 ),
		);
	}
}
