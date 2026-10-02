<?php
/** @package PixelPair */

use PixelPair\Activation;
use PixelPair\Uninstall;

final class UninstallTest extends LifecycleTestCase {
	public function test_uninstall_after_migration_of_autoloaded_schema_version(): void {
		add_option( 'pixelpair_db_version', '5', '', true );
		get_option( 'pixelpair_db_version' );
		Activation::activate( false );
		$this->assertSame( '7', get_option( 'pixelpair_db_version' ) );
		Uninstall::run();
		$this->assertFalse( get_option( 'pixelpair_db_version' ) );
	}

	public function test_uninstall_removes_only_owned_data_and_caps_from_all_roles(): void {
		Activation::activate( false );
		get_role( 'editor' )->add_cap( 'manage_pixelpair' );
		update_option( 'other_plugin_test_unrelated', 'preserve' );
		try {
			Uninstall::run();
			$this->assertFalse( get_option( 'pixelpair_settings' ) );
			$this->assertFalse( get_option( 'pixelpair_db_version' ) );
			$this->assertFalse( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
			$this->assertFalse( get_role( 'editor' )->has_cap( 'manage_pixelpair' ) );
			$this->assertTrue( get_role( 'editor' )->has_cap( 'edit_posts' ) );
			$this->assertSame( 'preserve', get_option( 'other_plugin_test_unrelated' ) );
		} finally {
			delete_option( 'other_plugin_test_unrelated' );
		}
	}

	public function test_retention_preserves_settings_and_caps_but_removes_scheduled_work(): void {
		Activation::activate( false );
		update_option( 'pixelpair_settings', array( 'keep_data_on_uninstall' => true ) );
		wp_schedule_single_event( time() + 60, 'pixelpair_initialize_network', array( 1, 2 ) );
		Uninstall::run();
		$this->assertSame( array( 'keep_data_on_uninstall' => true ), get_option( 'pixelpair_settings' ) );
		$this->assertTrue( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
		$this->assertFalse( wp_next_scheduled( 'pixelpair_initialize_network', array( 1, 2 ) ) );
	}
}
