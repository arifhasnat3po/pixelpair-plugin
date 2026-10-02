<?php
/** @package PixelPair */

use PixelPair\Settings\Repository;
use PixelPair\Settings\Migrations;

final class SettingsTest extends LifecycleTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->assertTrue( class_exists( Repository::class ), 'Settings repository has not been implemented.' );
	}

	public function test_defaults_disable_tracking_without_excluding_roles(): void {
		$settings = ( new Repository() )->get();
		$this->assertFalse( $settings['meta_enabled'] );
		$this->assertSame( '', $settings['meta_pixel_id'] );
		$this->assertSame( array(), $settings['excluded_roles'] );
		$this->assertSame( array(), $settings['excluded_ips'] );
		$this->assertTrue( $settings['exclude_bots'] );
		$this->assertFalse( $settings['strict_cache_mode'] );
		$this->assertFalse( $settings['deny_until_consent'] );
	}

	/** @dataProvider valid_ids */
	public function test_valid_string_ids_are_saved_without_numeric_coercion( string $id, string $expected ): void {
		$result = ( new Repository() )->update( array( 'meta_enabled' => true, 'meta_pixel_id' => $id ) );
		$this->assertIsArray( $result );
		$this->assertSame( $expected, $result['meta_pixel_id'] );
		$this->assertSame( $expected, get_option( 'pixelpair_settings' )['meta_pixel_id'] );
		$this->assertArrayHasKey( 'pixelpair_settings', wp_load_alloptions() );
	}

	public static function valid_ids(): array {
		return array(
			array( '123456789012345', '123456789012345' ),
			array( '0123456789012345', '0123456789012345' ),
			array( "  1234567890123456 \n", '1234567890123456' ),
		);
	}

	/** @dataProvider invalid_changes */
	public function test_rejected_changes_leave_the_complete_option_unchanged( array $change ): void {
		$repository = new Repository();
		$repository->update( array( 'meta_enabled' => true, 'meta_pixel_id' => '123456789012345' ) );
		$before = get_option( 'pixelpair_settings' );
		$result = $repository->update( $change );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( $before, get_option( 'pixelpair_settings' ) );
		$this->assertSame( 400, $result->get_error_data()['status'] );
	}

	public static function invalid_changes(): array {
		$cases = array();
		foreach ( array( '', '12345678901234', '12345678901234567', '1.23456789012345e14', '<script>123456789012345</script>', 123456789012345, true, null, array( '123456789012345' ) ) as $i => $id ) {
			$cases[ 'bad ID ' . $i ] = array( array( 'meta_pixel_id' => $id ) );
		}
		return array_merge( $cases, array(
			'string flag' => array( array( 'meta_enabled' => 'false' ) ),
			'numeric flag' => array( array( 'strict_cache_mode' => 1 ) ),
			'unknown setting' => array( array( 'capi_token' => 'must-not-store' ) ),
			'invalid role' => array( array( 'excluded_roles' => array( 'does-not-exist' ) ) ),
			'role string' => array( array( 'excluded_roles' => 'administrator' ) ),
			'invalid IPv4' => array( array( 'excluded_ips' => array( '999.1.1.1' ) ) ),
			'v4 prefix' => array( array( 'excluded_ips' => array( '192.0.2.1/33' ) ) ),
			'v6 prefix' => array( array( 'excluded_ips' => array( '2001:db8::1/129' ) ) ),
			'negative prefix' => array( array( 'excluded_ips' => array( '::1/-1' ) ) ),
			'zone identifier' => array( array( 'excluded_ips' => array( 'fe80::1%eth0' ) ) ),
			'CIDR junk' => array( array( 'excluded_ips' => array( '192.0.2.1/24evil' ) ) ),
			'mixed atomic failure' => array( array( 'strict_cache_mode' => true, 'excluded_ips' => array( '192.0.2.4', 'nope' ) ) ),
		) );
	}

	public function test_empty_id_is_allowed_only_while_disabled_and_roles_ips_round_trip(): void {
		$repository = new Repository();
		$result = $repository->update( array(
			'meta_enabled' => false, 'meta_pixel_id' => '', 'excluded_roles' => array( 'administrator', 'subscriber' ),
			'excluded_ips' => array( '192.0.2.4', '192.0.2.0/24', '2001:db8::/32', '::1/128' ),
			'strict_cache_mode' => true, 'keep_data_on_uninstall' => true,
		) );
		$this->assertIsArray( $result );
		$this->assertSame( $result, $repository->get() );
		$this->assertInstanceOf( WP_Error::class, $repository->update( array( 'meta_enabled' => true ) ) );
	}

	public function test_read_allow_list_never_exposes_unknown_stored_values_and_corruption_disables_tracking(): void {
		update_option( 'pixelpair_settings', array( 'keep_data_on_uninstall' => true, 'future_secret' => 'hidden' ) );
		$result = ( new Repository() )->get();
		$this->assertArrayNotHasKey( 'future_secret', $result );
		$this->assertTrue( $result['keep_data_on_uninstall'] );
		update_option( 'pixelpair_settings', array( 'meta_enabled' => true, 'meta_pixel_id' => '123456789012345', 'excluded_ips' => 'corrupt' ) );
		$this->assertFalse( ( new Repository() )->get()['meta_enabled'] );
	}

	public function test_legacy_schema_upgrade_preserves_retention_and_supplies_new_defaults(): void {
		update_option( 'pixelpair_db_version', '1', false );
		update_option( 'pixelpair_settings', array( 'keep_data_on_uninstall' => true, 'future_setting' => 'keep' ) );
		Migrations::run();
		Migrations::run();
		$stored = get_option( 'pixelpair_settings' );
		$this->assertTrue( $stored['keep_data_on_uninstall'] );
		$this->assertSame( 'keep', $stored['future_setting'] );
		$this->assertFalse( $stored['meta_enabled'] );
		$this->assertSame( '7', get_option( 'pixelpair_db_version' ) );
	}

	public function test_removed_role_preserves_other_preferences_on_read_and_partial_save(): void {
		add_role( 'pixelpair_temporary_member', 'Temporary member', array( 'read' => true ) );
		$repository = new Repository();
		try {
			$before = $repository->update( array(
				'meta_enabled' => true, 'meta_pixel_id' => '123456789012345',
				'excluded_roles' => array( 'subscriber', 'pixelpair_temporary_member' ),
				'excluded_ips' => array( '192.0.2.0/24' ), 'strict_cache_mode' => true,
				'deny_until_consent' => true, 'keep_data_on_uninstall' => true,
			) );
			remove_role( 'pixelpair_temporary_member' );
			$expected = array_replace( $before, array( 'excluded_roles' => array( 'subscriber' ) ) );
			$this->assertSame( $expected, $repository->get() );
			$this->assertSame( $before, get_option( 'pixelpair_settings' ), 'Reads must not rewrite storage.' );
			$expected['consent_notice_dismissed'] = true;
			$this->assertSame( $expected, $repository->update( array( 'consent_notice_dismissed' => true ) ) );
			$this->assertSame( $expected, get_option( 'pixelpair_settings' ) );
			$this->assertSame( $expected, $repository->update( $repository->get() ), 'The full admin form must still save.' );
		} finally {
			remove_role( 'pixelpair_temporary_member' );
		}
	}

	public function test_partial_save_does_not_persist_fallback_defaults_over_corrupt_storage(): void {
		$before = array( 'meta_enabled' => true, 'meta_pixel_id' => '123456789012345', 'excluded_ips' => 'corrupt', 'keep_data_on_uninstall' => true );
		update_option( 'pixelpair_settings', $before );
		$this->assertInstanceOf( WP_Error::class, ( new Repository() )->update( array( 'consent_notice_dismissed' => true ) ) );
		$this->assertSame( $before, get_option( 'pixelpair_settings' ) );
	}

	public function test_unchanged_save_succeeds_but_rejected_write_returns_an_error(): void {
		$repository = new Repository();
		$before = $repository->update( array( 'meta_enabled' => true, 'meta_pixel_id' => '123456789012345' ) );
		$this->assertSame( $before, $repository->update( $before ) );
		$reject = static function ( $new_value, $old_value ) { return $old_value; };
		add_filter( 'pre_update_option_pixelpair_settings', $reject, 10, 2 );
		try {
			$result = $repository->update( array( 'meta_enabled' => false, 'deny_until_consent' => true ) );
			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'pixelpair_save_failed', $result->get_error_code() );
			$this->assertSame( 500, $result->get_error_data()['status'] );
			$this->assertSame( $before, get_option( 'pixelpair_settings' ) );
		} finally {
			remove_filter( 'pre_update_option_pixelpair_settings', $reject );
		}
	}
}
