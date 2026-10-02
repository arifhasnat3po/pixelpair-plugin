<?php
/**
 * Best-effort transient limits for the public eligibility endpoint.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Support;

/** Bound repeated gate calls without storing raw visitor addresses. */
final class RateLimiter {
	/**
	 * Consume one request in a fixed one-minute window.
	 *
	 * @param string $ip Direct connection address.
	 * @param string $scope Separate endpoint budget.
	 * @return bool
	 */
	public static function allow( string $ip, string $scope = 'gate' ): bool {
		$key   = self::key( $ip, $scope );
		$state = get_transient( $key );
		$limit = max( 1, (int) ( 'event' === $scope ? apply_filters( 'pixelpair_event_rate_limit', 60 ) : apply_filters( 'pixelpair_bootstrap_rate_limit', 60 ) ) );
		$state = is_array( $state ) && isset( $state['until'], $state['count'] ) && $state['until'] > time() ? $state : array(
			'until' => time() + 60,
			'count' => 0,
		);
		if ( $state['count'] >= $limit ) {
			return false;
		}
		++$state['count'];
		set_transient( $key, $state, max( 1, $state['until'] - time() ) );
		return true;
	}
	/**
	 * Reset a connection's limit for operational recovery.
	 *
	 * @param string $ip Direct connection address.
	 * @param string $scope Separate endpoint budget.
	 */
	public static function clear( string $ip, string $scope = 'gate' ): void {
		delete_transient( self::key( $ip, $scope ) );
	}
	/**
	 * Derive an opaque site-scoped transient name.
	 *
	 * @param string $ip Address.
	 * @param string $scope Separate endpoint budget.
	 * @return string
	 */
	private static function key( string $ip, string $scope ): string {
		return 'pixelpair_' . $scope . '_' . hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) );
	}
}
