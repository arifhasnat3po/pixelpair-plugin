<?php
/**
 * Test isolation helpers for the disposable WordPress database.
 *
 * @package PixelPair
 */

use PHPUnit\Framework\TestCase;

abstract class LifecycleTestCase extends TestCase {
	/** @var array<string, mixed> */
	private $saved_options = array();
	/** @var array<string, bool> */
	private $saved_caps = array();
	private $saved_server = array();
	private $saved_cookies = array();

	protected function setUp(): void {
		parent::setUp();
		$this->saved_server = $_SERVER;
		$this->saved_cookies = $_COOKIE;
		$this->assertTrue( class_exists( \PixelPair\Activation::class ), 'Activation service is not implemented.' );
		foreach ( array( 'pixelpair_settings', 'pixelpair_db_version' ) as $option ) {
			$this->saved_options[ $option ] = get_option( $option );
			delete_option( $option );
		}
		foreach ( wp_roles()->roles as $name => $role ) {
			$this->saved_caps[ $name ] = ! empty( $role['capabilities']['manage_pixelpair'] );
			get_role( $name )->remove_cap( 'manage_pixelpair' );
		}
	}

	protected function tearDown(): void {
		foreach ( $this->saved_options as $option => $value ) {
			delete_option( $option );
			if ( false !== $value ) {
				add_option( $option, $value );
			}
		}
		foreach ( $this->saved_caps as $name => $enabled ) {
			$role = get_role( $name );
			if ( $enabled ) {
				$role->add_cap( 'manage_pixelpair' );
			} else {
				$role->remove_cap( 'manage_pixelpair' );
			}
		}
		wp_set_current_user( 0 );
		$_SERVER = $this->saved_server;
		$_COOKIE = $this->saved_cookies;
		parent::tearDown();
	}
}
