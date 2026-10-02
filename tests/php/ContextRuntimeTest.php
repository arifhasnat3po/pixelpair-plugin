<?php
/** @package PixelPair */

/**
 * Exercise optional-plugin signals without claiming those products were installed.
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class ContextRuntimeTest extends LifecycleTestCase {
	/** @dataProvider runtime_contexts */
	public function test_non_public_runtime_contexts( string $constant ): void {
		define( $constant, true );
		$this->assertTrue( ( new \PixelPair\Exclusions\ContextDetector() )->is_excluded() );
	}
	public static function runtime_contexts(): array { return array( array( 'DOING_CRON' ), array( 'DOING_AJAX' ), array( 'REST_REQUEST' ), array( 'WP_ADMIN' ) ); }
	public function test_optional_builder_api_fixtures(): void {
		require __DIR__ . '/fixtures/contexts.php';
		$detector = new \PixelPair\Exclusions\ContextDetector();
		$this->assertFalse( $detector->is_excluded() );
		foreach ( array( 'bricks', 'beaver', 'amp', 'elementor-editor', 'elementor-preview' ) as $context ) {
			$GLOBALS['pixelpair_test_context'] = $context;
			$this->assertTrue( $detector->is_excluded(), $context );
		}
	}
}
