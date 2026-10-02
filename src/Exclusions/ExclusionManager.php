<?php
/**
 * Central visitor exclusion policy.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Exclusions;

use PixelPair\Settings\Repository;
use PixelPair\Support\Request;

/** Apply current authenticated roles and connection information. */
final class ExclusionManager {
	/**
	 * Evaluate the actual visitor, including IP exclusions at the uncached gate.
	 *
	 * @param string $source_url Same-origin public source URL.
	 * @param bool   $render Whether checking cacheable render context.
	 * @return bool
	 */
	public function should_track( string $source_url, bool $render = false ): bool {
		$settings = ( new Repository() )->get();
		$context  = new ContextDetector();
		$allowed  = ! $context->excluded_url( $source_url ) && ( ! $render || ! $context->is_excluded() );
		if ( array_intersect( wp_get_current_user()->roles, $settings['excluded_roles'] ) ) {
			$allowed = false;
		}
		if ( ! $render ) {
			foreach ( $settings['excluded_ips'] as $entry ) {
				if ( '' === Request::client_ip() || IpMatcher::matches( Request::client_ip(), $entry ) ) {
					$allowed = false;
				}
			}
		}
		$agent = Request::server( 'HTTP_USER_AGENT' );
		if ( $settings['exclude_bots'] && BotDetector::is_bot( $agent ) && ! ( $render && BotDetector::is_preloader( $agent ) ) ) {
			$allowed = false;
		}
		// A filter can veto eligibility; it cannot undo a built-in exclusion.
		return $allowed && (bool) apply_filters( 'pixelpair_should_track', true, $source_url );
	}
}
