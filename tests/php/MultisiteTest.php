<?php
/** @package PixelPair */

use PixelPair\Activation;
use PixelPair\Deactivation;
use PixelPair\Uninstall;

/** @group multisite */
final class MultisiteTest extends LifecycleTestCase {
	public function test_site_administrator_cannot_save_raw_scripts(): void {
		$id=wp_create_user('script-site-'.wp_generate_password(8,false),'password');$user=new WP_User($id);$user->set_role('administrator');$user->add_cap('manage_pixelpair');wp_set_current_user($id);
		try {$this->assertFalse(is_super_admin($id));$this->assertFalse(\PixelPair\Scripts\Repository::allowed());$this->assertInstanceOf(WP_Error::class,(new \PixelPair\Scripts\Repository())->save(\PixelPair\Scripts\Repository::defaults()));} finally {require_once ABSPATH.'wp-admin/includes/ms.php';wpmu_delete_user($id);}
	}
	public function test_deferred_batches_reactivation_and_network_deactivation(): void {
		$this->assertTrue( is_multisite() );
		$original = get_current_blog_id();
		$network = get_network();
		$sites = array();
		$active = get_site_option( 'active_sitewide_plugins', array() );
		$inactive = $active;
		unset( $inactive['pixelpair/pixelpair.php'] );
		update_site_option( 'active_sitewide_plugins', $inactive );
		try {
			for ( $i = 0; $i < 100; $i++ ) {
				$id = wpmu_create_blog( $network->domain, '/pixelpair-batch-' . wp_generate_password( 12, false ) . '/', 'Batch site', 1 );
				$this->assertIsInt( $id );
				$sites[] = $id;
			}
			$last = end( $sites );
			update_option( 'pixelpair_settings', array( 'keep_data_on_uninstall' => true ) );
			Activation::activate( true );
			Activation::activate( true );
			$this->assertSame( $original, get_current_blog_id() );
			$this->assertTrue( get_option( 'pixelpair_settings' )['keep_data_on_uninstall'] );
			$this->assertFalse( get_option( 'pixelpair_settings' )['meta_enabled'] );
			$args = array( (int) $network->id, 100 );
			$event = wp_get_scheduled_event( 'pixelpair_initialize_network', $args );
			$this->assertIsObject( $event );
			switch_to_blog( $last );
			$this->assertFalse( get_option( 'pixelpair_settings' ), 'The final site must wait for the deferred batch.' );
			restore_current_blog();
			// Emulate WP-Cron consuming the queued event through the registered hook.
			wp_unschedule_event( $event->timestamp, 'pixelpair_initialize_network', $args );
			do_action_ref_array( 'pixelpair_initialize_network', $event->args );
			$this->assertSame( $original, get_current_blog_id() );
			switch_to_blog( $last );
			$this->assertTrue( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
			$this->assertIsArray( get_option( 'pixelpair_settings' ) );
			wp_schedule_single_event( time() + 60, 'pixelpair_initialize_network', array( 9, 9 ) );
			wp_schedule_single_event( time() + 60, 'pixelpair_test_unrelated' );
			restore_current_blog();
			$this->assertFalse( wp_next_scheduled( 'pixelpair_initialize_network', $args ) );
			Deactivation::deactivate( true );
			$this->assertSame( $original, get_current_blog_id() );
			switch_to_blog( $last );
			$this->assertFalse( wp_next_scheduled( 'pixelpair_initialize_network', array( 9, 9 ) ) );
			$this->assertNotFalse( wp_next_scheduled( 'pixelpair_test_unrelated' ) );
			$this->assertIsArray( get_option( 'pixelpair_settings' ) );
			restore_current_blog();
		} finally {
			while ( get_current_blog_id() !== $original ) {
				restore_current_blog();
			}
			Deactivation::deactivate( true );
			foreach ( $sites as $id ) {
				wpmu_delete_blog( $id, true );
			}
			update_site_option( 'active_sitewide_plugins', $active );
		}
	}

	public function test_network_activation_new_sites_and_per_site_retention(): void {
		$this->assertTrue( is_multisite(), 'Run this group against the dedicated multisite environment.' );
		$original = get_current_blog_id();
		$domain   = get_network()->domain;
		$site_id  = wpmu_create_blog( $domain, '/pixelpair-test-' . wp_generate_password( 8, false ) . '/', 'PixelPair test', 1 );
		$this->assertIsInt( $site_id );
		try {
			Activation::activate( true );
			$this->assertSame( $original, get_current_blog_id() );
			switch_to_blog( $site_id );
			$this->assertTrue( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
			update_option( 'pixelpair_settings', array( 'keep_data_on_uninstall' => true ) );
			restore_current_blog();
			Uninstall::run();
			$this->assertSame( $original, get_current_blog_id() );
			$this->assertFalse( get_option( 'pixelpair_settings' ) );
			switch_to_blog( $site_id );
			$this->assertSame( array( 'keep_data_on_uninstall' => true ), get_option( 'pixelpair_settings' ) );
			restore_current_blog();
			// The new-site hook is registered by Plugin; network-active state is explicit.
			$active = get_site_option( 'active_sitewide_plugins', array() );
			update_site_option( 'active_sitewide_plugins', array_merge( $active, array( 'pixelpair/pixelpair.php' => time() ) ) );
			try {
				$new_site = wpmu_create_blog( $domain, '/pixelpair-new-' . wp_generate_password( 8, false ) . '/', 'New site', 1 );
				$this->assertIsInt( $new_site );
				switch_to_blog( $new_site );
				$this->assertTrue( get_role( 'administrator' )->has_cap( 'manage_pixelpair' ) );
				$this->assertIsArray( get_option( 'pixelpair_settings' ) );
				restore_current_blog();
				wpmu_delete_blog( $new_site, true );
			} finally {
				update_site_option( 'active_sitewide_plugins', $active );
			}
		} finally {
			while ( get_current_blog_id() !== $original ) {
				restore_current_blog();
			}
			wpmu_delete_blog( $site_id, true );
		}
	}
}
