<?php
/** @package PixelPair */
use PixelPair\UserData\Normalizer;
use PixelPair\UserData\Cookies;
use PixelPair\UserData\Collector;
use PixelPair\Settings\Repository;

final class UserDataTest extends LifecycleTestCase {
	public function test_forwarded_ip_requires_explicit_proxy_trust_and_rejects_invalid_input(): void {
		$_SERVER['HTTP_X_FORWARDED_FOR']='192.0.2.20, 10.0.0.1';
		try {
			$this->assertSame('127.0.0.1',\PixelPair\Support\Request::client_ip());
			(new Repository())->update(array('trust_proxy'=>true));
			$this->assertSame('192.0.2.20',\PixelPair\Support\Request::client_ip());
			$_SERVER['HTTP_X_FORWARDED_FOR']='bad';
			$this->assertSame('',\PixelPair\Support\Request::client_ip());
		} finally { unset($_SERVER['HTTP_X_FORWARDED_FOR']); }
	}
	/** @dataProvider examples */
	public function test_matching_normalization( string $field, string $raw, string $expected ): void {
		$this->assertTrue( class_exists( Normalizer::class ), 'Matching normalization is missing.' );
		$this->assertSame( $expected, Normalizer::normalize( $field, $raw ) );
	}
	public static function examples(): array {
		return array(
			array('em', ' Alice@Example.COM ', 'alice@example.com'), array('em','not-email',''),
			array('ph','+1 (415) 555-0132','14155550132'), array('ph','01712345678',''),
			array('fn',' Alice! ','alice'), array('ln'," O'Neil ",'oneil'),
			array('ct',' New York ','newyork'), array('st',' CA ','ca'),
			array('zp',' SW1A 1AA ','sw1a1aa'), array('country',' US ','us'), array('country','zz',''),
			array('db','1980-02-29','19800229'), array('db','2023-02-29',''),
			array('ge','F','f'), array('ge','unknown',''), array('external_id',' user-12 ','user-12'),
		);
	}
	public function test_cookies_are_valid_stable_and_click_id_is_not_fabricated(): void {
		$this->assertTrue( class_exists( Cookies::class ), 'Cookie helpers are missing.' );
		$saved = $_COOKIE;
		try {
			$_COOKIE = array();
			$one = Cookies::values( home_url( '/?fbclid=ABC_123-test' ) );
			$this->assertMatchesRegularExpression('/^fb\.1\.\d{13}\.\d+$/', $one['fbp']);
			$this->assertMatchesRegularExpression('/^fb\.1\.\d{13}\.ABC_123-test$/', $one['fbc']);
			$this->assertSame($one, Cookies::values(home_url('/next')));
			$_COOKIE = array();
			$this->assertArrayNotHasKey('fbc', Cookies::values(home_url('/')));
		} finally { $_COOKIE = $saved; }
	}
	public function test_only_enabled_matching_uses_logged_in_identity_and_returns_hashes(): void {
		$this->assertTrue( class_exists( Collector::class ), 'Identity collector is missing.' );
		$user = get_users(array('role'=>'administrator','number'=>1))[0];
		wp_set_current_user($user->ID);
		$off = (new Collector())->collect(home_url('/'));
		$this->assertArrayNotHasKey('em', $off);
		(new Repository())->update(array('meta_advanced_matching'=>true));
		$on = (new Collector())->collect(home_url('/'));
		$this->assertSame(array(hash('sha256',strtolower(trim($user->user_email)))), $on['em']);
		$this->assertSame(array(hash('sha256',(string)$user->ID)), $on['external_id']);
		$this->assertStringNotContainsString($user->user_email, wp_json_encode($on));
	}
}
