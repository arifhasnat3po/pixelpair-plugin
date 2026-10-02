<?php
/** @package PixelPair */

use PixelPair\Activation;
use PixelPair\Admin\Assets;
use PixelPair\Admin\Menu;

final class AdminTest extends LifecycleTestCase {
	public function test_built_dependencies_are_registered_by_supported_wordpress(): void {
		$asset = require dirname( __DIR__, 2 ) . '/build/admin.asset.php';
		foreach ( $asset['dependencies'] as $handle ) {
			$this->assertTrue( wp_script_is( $handle, 'registered' ), 'Unsupported script dependency: ' . $handle );
		}
	}

	public function test_admin_assets_are_scoped_to_the_plugin_menu(): void {
		Activation::activate( false );
		$admin = get_users( array( 'role' => 'administrator', 'number' => 1 ) )[0];
		wp_set_current_user( $admin->ID );
		$assets = new Assets();
		$assets->enqueue( 'dashboard' );
		$this->assertFalse( wp_script_is( 'pixelpair-admin', 'enqueued' ) );
		$assets->enqueue( 'toplevel_page_pixelpair' );
		$this->assertTrue( wp_script_is( 'pixelpair-admin', 'enqueued' ) );
		$this->assertTrue( wp_style_is( 'pixelpair-admin', 'enqueued' ) );
		wp_dequeue_script( 'pixelpair-admin' );
		wp_dequeue_style( 'pixelpair-admin' );
	}

	public function test_capability_holder_can_render_the_mount(): void {
		Activation::activate( false );
		$admin = get_users( array( 'role' => 'administrator', 'number' => 1 ) )[0];
		wp_set_current_user( $admin->ID );
		ob_start();
		( new Menu() )->render();
		$output = ob_get_clean();
		$this->assertStringContainsString( 'id="pixelpair-admin"', $output );
		$this->assertStringContainsString( 'aria-label=', $output );
	}

	public function test_unauthorized_direct_render_is_rejected(): void {
		wp_set_current_user( 0 );
		$handler = static function () {
			return static function () {
				throw new RuntimeException( 'Access rejected' );
			};
		};
		add_filter( 'wp_die_handler', $handler );
		try {
			$this->expectExceptionMessage( 'Access rejected' );
			( new Menu() )->render();
		} finally {
			remove_filter( 'wp_die_handler', $handler );
		}
	}
}
