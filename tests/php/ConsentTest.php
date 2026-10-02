<?php
/** @package PixelPair */
use PixelPair\Integrations\Consent\ConsentManager;
use PixelPair\Settings\Repository;

final class ConsentTest extends LifecycleTestCase {
	protected function setUp(): void {parent::setUp();$this->assertTrue(class_exists(ConsentManager::class),'Consent not implemented.');}
	protected function tearDown(): void {remove_all_filters('pixelpair_consent_tools');remove_all_filters('pixelpair_consent_marketing');parent::tearDown();}
	public function test_default_force_denied_unresolved_and_filter_veto(): void {
		$consent=new ConsentManager();$this->assertTrue($consent->allows_marketing());
		(new Repository())->update(array('deny_until_consent'=>true));$this->assertFalse($consent->allows_marketing());
		(new Repository())->update(array('deny_until_consent'=>false));
		add_filter('pixelpair_consent_tools',static function(){return array('cookiebot');});$this->assertFalse($consent->allows_marketing());
		$this->assertTrue($consent->allows_marketing(array('source'=>'cookiebot','granted'=>true)));
		$this->assertFalse($consent->allows_marketing(array('source'=>'cookiebot','granted'=>false)));
		add_filter('pixelpair_consent_marketing','__return_false');$this->assertFalse($consent->allows_marketing(array('source'=>'cookiebot','granted'=>true)));
	}
	public function test_unknown_cmp_stays_blocked_and_public_config_is_site_level(): void {
		add_filter('pixelpair_consent_tools',static function(){return array('unknown-cmp');});
		$consent=new ConsentManager();$this->assertFalse($consent->allows_marketing());
		$this->assertFalse($consent->allows_marketing(array('source'=>'cookiebot','granted'=>true)));
		$this->assertSame(array('unknown-cmp'),$consent->config()['tools']);$this->assertFalse($consent->config()['required']);$this->assertFalse($consent->config()['statistics_blocked']);
	}
	public function test_notice_only_appears_to_authorized_admin_without_tool_and_dismissal_checks_nonce(): void {
		\PixelPair\Activation::activate(false);wp_set_current_user(get_users(array('role'=>'administrator','number'=>1))[0]->ID);
		$notice=new \PixelPair\Admin\ConsentNotice();ob_start();$notice->render();$html=ob_get_clean();$this->assertStringContainsString('EU/UK',$html);
		$this->assertInstanceOf(WP_Error::class,$notice->dismiss('invalid'));
		$this->assertTrue($notice->dismiss(wp_create_nonce('pixelpair_dismiss_consent')));
		ob_start();$notice->render();$this->assertSame('',ob_get_clean());
		wp_set_current_user(0);$this->assertInstanceOf(WP_Error::class,$notice->dismiss(wp_create_nonce('pixelpair_dismiss_consent')));
	}
}
