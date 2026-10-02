<?php
/** @package PixelPair */

use PixelPair\Admin\Menu;

final class BrandTest extends LifecycleTestCase {
	public function test_credit_is_scoped_to_our_admin_screen(): void {
		require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		require_once ABSPATH . 'wp-admin/includes/screen.php';
		$menu = new Menu();
		try {
			set_current_screen( 'dashboard' );
			$this->assertSame( 'Original footer', $menu->footer( 'Original footer' ) );
			set_current_screen( 'toplevel_page_pixelpair' );
			$this->assertSame( 'PixelPair, built by <a href="https://github.com/arifhasnat3po">Arif Hasnat</a>', $menu->footer( 'Original footer' ) );
			set_current_screen( 'front' );
			$this->assertSame( 'Original footer', $menu->footer( 'Original footer' ) );
		} finally { set_current_screen( 'front' ); }
	}
	public function test_menu_uses_a_recolorable_local_mark_and_header_credits_author(): void {
		$icon = Menu::icon();
		$this->assertStringStartsWith( 'data:image/svg+xml;base64,', $icon );
		$svg = base64_decode( substr( $icon, strlen( 'data:image/svg+xml;base64,' ) ) );
		$this->assertStringContainsString( 'viewBox="0 0 24 24"', $svg );
		$this->assertStringContainsString( 'fill="black"', $svg );
		$this->assertStringNotContainsString( '<text', $svg );
		$header = get_plugin_data( PIXELPAIR_FILE, false, false );
		$this->assertSame( 'PixelPair – Meta Pixel, Conversions API, GA4 & TikTok for WooCommerce', $header['Name'] );
		$this->assertSame( 'Arif Hasnat', $header['Author'] );
		$this->assertSame( 'https://github.com/arifhasnat3po', $header['AuthorURI'] );
	}
}
