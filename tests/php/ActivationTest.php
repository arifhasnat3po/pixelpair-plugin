<?php
/** @package PixelPair */

use PixelPair\Activation;
use PixelPair\Deactivation;

final class ActivationTest extends LifecycleTestCase {
	public function test_cli_activation_accepts_an_unspecified_network_flag(): void {
		Activation::activate( null );
		$this->assertTrue( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
		$this->assertIsArray( get_option( 'pixelpair_settings' ) );
	}

	public function test_cli_deactivation_accepts_an_unspecified_network_flag(): void {
		Activation::activate( false );
		wp_schedule_single_event( time() + 60, 'pixelpair_queue_sweep' );
		Deactivation::deactivate( null );
		$this->assertFalse( wp_next_scheduled( 'pixelpair_queue_sweep' ) );
		$this->assertIsArray( get_option( 'pixelpair_settings' ) );
	}

	public function test_activation_grants_only_administrators_and_creates_autoloaded_defaults(): void {
		Activation::activate( false );
		$this->assertTrue( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
		$this->assertFalse( get_role( 'subscriber' )->has_cap( 'manage_pixelpair' ) );
		$this->assertFalse( get_option( 'pixelpair_settings' )['keep_data_on_uninstall'] );
		$this->assertFalse( get_option( 'pixelpair_settings' )['meta_enabled'] );
		$this->assertArrayHasKey( 'pixelpair_settings', wp_load_alloptions() );
		$this->assertSame( '7', get_option( 'pixelpair_db_version' ) );
	}

	public function test_reactivation_preserves_existing_settings_and_unrelated_options(): void {
		update_option( 'pixelpair_settings', array( 'keep_data_on_uninstall' => true, 'future_setting' => 'keep' ) );
		update_option( 'pixelpair_test_unrelated', 'keep' );
		try {
			Activation::activate( false );
			Activation::activate( false );
			$this->assertTrue( get_option( 'pixelpair_settings' )['keep_data_on_uninstall'] );
			$this->assertSame( 'keep', get_option( 'pixelpair_settings' )['future_setting'] );
			$this->assertSame( 'keep', get_option( 'pixelpair_test_unrelated' ) );
		} finally {
			delete_option( 'pixelpair_test_unrelated' );
		}
	}

	public function test_deactivation_clears_owned_jobs_without_removing_settings_or_other_jobs(): void {
		Activation::activate( false );
		wp_schedule_single_event( time() + 60, 'pixelpair_initialize_network', array( 1, 2 ) );
		wp_schedule_single_event( time() + 60, 'pixelpair_test_unrelated' );
		try {
			Deactivation::deactivate( false );
			$this->assertFalse( wp_next_scheduled( 'pixelpair_initialize_network', array( 1, 2 ) ) );
			$this->assertNotFalse( wp_next_scheduled( 'pixelpair_test_unrelated' ) );
			$this->assertIsArray( get_option( 'pixelpair_settings' ) );
		} finally {
			wp_clear_scheduled_hook( 'pixelpair_test_unrelated' );
		}
	}
}
