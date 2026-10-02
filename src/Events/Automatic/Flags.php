<?php
/**
 * Short-lived successful action flags, outside cached HTML.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** A random cookie locates a nonautoloaded, actor-bound, single-consumption option. */
final class Flags {
	/** Register confirmed WordPress success hooks. */
	public function register(): void {
		add_action( 'wp_login', array( $this, 'login' ), 10, 2 );
		add_action( 'user_register', array( $this, 'signup' ) );
		add_action( 'comment_post', array( $this, 'comment' ), 10, 2 );
		add_action( 'pixelpair_log_purge', array( self::class, 'purge' ) );
	}
	/**
	 * Service operation.
	 *
	 * @param string   $login Login name, never stored.
	 * @param \WP_User $user Authenticated actor.
	 */
	public function login( string $login, \WP_User $user ): void {
		self::mark( 'login', (int) $user->ID );
	}
	/**
	 * Service operation.
	 *
	 * @param int $id New actor.
	 */
	public function signup( int $id ): void {
		if ( $id > 0 && ! is_admin() && ! is_user_logged_in() ) {
			self::mark( 'sign_up', 0 );
		}}
	/**
	 * Service operation.
	 *
	 * @param int        $id Comment ID, never stored.
	 * @param int|string $approved Moderation result.
	 */
	public function comment( int $id, $approved ): void {
		if ( 'spam' !== $approved && 'trash' !== $approved ) {
			self::mark( 'comment', get_current_user_id() );
		}}
	/**
	 * Service operation.
	 *
	 * @param string $event Allowed internal event.
	 * @param int    $actor Actor ID.
	 */
	public static function mark( string $event, int $actor ): void {
		$settings = ( new \PixelPair\Settings\Repository() )->get();
		$manager  = new \PixelPair\Integrations\Consent\ConsentManager();
		$allowed  = $manager->allows_marketing() || $manager->allows( 'statistics' );
		// A client declares consent only; this method runs after WordPress confirms success.
		$browser = self::submitted_consent();
		foreach ( array( 'marketing', 'statistics' ) as $category ) {
			if ( isset( $browser[ $category ] ) && $manager->allows( $category, $browser[ $category ] ) ) {
				$allowed = true;
			}
		}
		if ( function_exists( 'wp_get_consent_type' ) && function_exists( 'wp_has_consent' ) && in_array( call_user_func( 'wp_get_consent_type' ), array( 'optin', 'optout' ), true ) ) {
			$allowed = ( false !== $manager->override() && call_user_func( 'wp_has_consent', 'marketing' ) ) || ( false !== $manager->override( 'statistics' ) && call_user_func( 'wp_has_consent', 'statistics' ) );
		}
		if ( ! $allowed || ( ! $settings['meta_enabled'] && ! $settings['ga4_enabled'] && ! $settings['gtm_enabled'] ) ) {
			return;
		}
		if ( ! in_array( $event, array( 'login', 'sign_up', 'comment' ), true ) ) {
			return;
		}
		$token = self::token();
		$key   = 'pixelpair_flag_' . $token;
		$value = $token ? get_option( $key ) : false;
		if ( ! is_array( $value ) || ( 0 !== $value['actor'] && $value['actor'] !== $actor ) || $value['expires'] < time() ) {
			$token = bin2hex( random_bytes( 16 ) );
			$key   = 'pixelpair_flag_' . $token;
			$value = array(
				'actor'   => $actor,
				'expires' => time() + 600,
				'events'  => array(),
			);
		}
		$value['actor']  = $actor;
		$value['events'] = array_values( array_unique( array_merge( $value['events'], array( $event ) ) ) );
		update_option( $key, $value, false );
		$_COOKIE['pixelpair_pending']     = $token;
		$_COOKIE['pixelpair_has_pending'] = '1';
		if ( ! headers_sent() ) {
			foreach ( array(
				'pixelpair_pending'     => $token,
				'pixelpair_has_pending' => '1',
			) as $name => $cookie ) {
				setcookie(
					$name,
					$cookie,
					array(
						'expires'  => time() + 600,
						'path'     => '/',
						'secure'   => is_ssl(),
						'httponly' => 'pixelpair_pending' === $name,
						'samesite' => 'Lax',
					)
				);
			}
		}
	}
	/**
	 * Service operation.
	 *
	 * @param int $actor Current verified actor.
	 * @return list<string> One-use event keys.
	 */
	public static function consume( int $actor ): array {
		$token = self::token();
		if ( ! $token ) {
			return array();
		}
		$key   = 'pixelpair_flag_' . $token;
		$value = get_option( $key );
		if ( ! is_array( $value ) || ( 0 !== $value['actor'] && $value['actor'] !== $actor ) || $value['expires'] < time() ) {
			return array();
		}
		// delete_option's affected-row result is the atomic claim, even with an object cache.
		if ( ! delete_option( $key ) ) {
			return array();
		}
		unset( $_COOKIE['pixelpair_pending'], $_COOKIE['pixelpair_has_pending'] );
		\PixelPair\Settings\Migrations::forget_cookie( 'pixelpair_pending' );
		\PixelPair\Settings\Migrations::forget_cookie( 'pixelpair_has_pending' );
		if ( ! headers_sent() ) {
			foreach ( array( 'pixelpair_pending', 'pixelpair_has_pending' ) as $name ) {
				setcookie(
					$name,
					'',
					array(
						'expires'  => time() - 3600,
						'path'     => '/',
						'secure'   => is_ssl(),
						'httponly' => 'pixelpair_pending' === $name,
						'samesite' => 'Lax',
					)
				);
			}
		}
		return $value['events'];
	}
	/**
	 * Service operation.
	 *
	 * @return array<string,array<string,mixed>> Bounded same-origin submitted decisions.
	 */
	private static function submitted_consent(): array {
		$origin = \PixelPair\Support\Request::server( 'HTTP_ORIGIN' );
		if ( ! $origin ) {
			$origin = \PixelPair\Support\Request::server( 'HTTP_REFERER' );
		}
		if ( 'POST' !== \PixelPair\Support\Request::server( 'REQUEST_METHOD' ) || ! \PixelPair\Support\Request::same_origin( $origin, home_url() ) ) {
			return array();
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing,WordPress.Security.ValidatedSanitizedInput -- No identity/action is accepted; strict JSON types validated below after a confirmed core success hook.
		$raw = $_POST['pixelpair_action_consent'] ?? '';
		if ( ! is_string( $raw ) || strlen( $raw ) > 1024 ) {
			return array();
		}
		$data = json_decode( wp_unslash( $raw ), true );
		if ( ! is_array( $data ) || array_diff( array_keys( $data ), array( 'marketing', 'statistics' ) ) ) {
			return array();
		}
		foreach ( $data as $decision ) {
			if ( ! is_array( $decision ) || array_diff( array_keys( $decision ), array( 'granted', 'source' ) ) || ! isset( $decision['granted'], $decision['source'] ) || ! is_bool( $decision['granted'] ) || ! is_string( $decision['source'] ) ) {
				return array();
			}
		}
		return $data;
	}
	/**
	 * Service operation.
	 *
	 * @return string Valid random locator, not an actor identity.
	 */
	private static function token(): string {
	 // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- Strict hexadecimal validation before use as an option suffix.
		$token = \PixelPair\Settings\Migrations::cookie( 'pixelpair_pending' );
		return is_string( $token ) && preg_match( '/\A[a-f0-9]{32}\z/', $token ) ? $token : '';
	}
	/** Expire abandoned flags in bounded batches during housekeeping. */
	public static function purge(): void {
		global $wpdb;
	 // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Bounded lookup of private transient-like options; individual deletes invalidate caches.
		$keys = $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s LIMIT 1000", $wpdb->esc_like( 'pixelpair_flag_' ) . '%' ) );
		foreach ( $keys as $key ) {
			$value = get_option( $key );
			if ( ! is_array( $value ) || ( $value['expires'] ?? 0 ) < time() ) {
				delete_option( $key );
			}
		}
	}
}
