<?php
/** @package PixelPair */

use PixelPair\Admin\ConsentNotice;
use PixelPair\Settings\Migrations;
use PixelPair\Settings\Repository;

final class AdminNoticeTest extends LifecycleTestCase {
	protected function setUp(): void {
		parent::setUp();
		require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		require_once ABSPATH . 'wp-admin/includes/screen.php';
		\PixelPair\Activation::activate(false);
		wp_set_current_user(get_users(array('role'=>'administrator','number'=>1))[0]->ID);
		(new Repository())->update(array('meta_enabled'=>true,'meta_pixel_id'=>'123456789012345'));
	}
	protected function tearDown(): void {
		remove_all_filters('pixelpair_consent_tools');
		set_current_screen('front');
		parent::tearDown();
	}
	private function render_notice(callable $callback): string {
		ob_start();
		$callback();
		return ob_get_clean();
	}
	public function test_recommendation_does_not_intrude_on_other_admin_screens(): void {
		$notice = new ConsentNotice();
		foreach(array('dashboard','plugins','edit-post','profile','dashboard-network') as $screen) {
			set_current_screen($screen);
			$this->assertSame('', $this->render_notice(array($notice,'render')), $screen);
		}
		set_current_screen('toplevel_page_pixelpair');
		$this->assertStringContainsString('pixelpair-consent-notice', $this->render_notice(array($notice,'render')));
		wp_set_current_user(0);
		$this->assertSame('', $this->render_notice(array($notice,'render')));
	}
	public function test_recommendation_clears_when_no_longer_applicable(): void {
		set_current_screen('toplevel_page_pixelpair');
		$notice = new ConsentNotice();
		$settings = new Repository();
		foreach(array('consent_notice_dismissed','deny_until_consent') as $key) {
			$settings->update(array($key=>true));
			$this->assertSame('', $this->render_notice(array($notice,'render')), $key);
			$settings->update(array($key=>false));
		}
		$settings->update(array('meta_enabled'=>false));
		$this->assertSame('', $this->render_notice(array($notice,'render')));
		$settings->update(array('meta_enabled'=>true));
		add_filter('pixelpair_consent_tools',static function(){ return array('cookiebot'); });
		$this->assertSame('', $this->render_notice(array($notice,'render')));
	}
	public function test_migration_error_only_appears_on_relevant_management_screens(): void {
		foreach(array('dashboard','edit-post','profile','dashboard-network') as $screen) {
			set_current_screen($screen);
			$this->assertSame('', $this->render_notice(array(Migrations::class,'notice')), $screen);
		}
		foreach(array('plugins','toplevel_page_pixelpair') as $screen) {
			set_current_screen($screen);
			$this->assertStringContainsString('Tracking is paused', $this->render_notice(array(Migrations::class,'notice')));
		}
		wp_set_current_user(0);
		$this->assertSame('', $this->render_notice(array(Migrations::class,'notice')));
	}
}
