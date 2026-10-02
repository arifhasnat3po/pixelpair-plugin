<?php
/**
 * Minimal marketing consent detection and policy.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Integrations\Consent;

use PixelPair\Settings\Repository;

/** Wait for detected consent tools; permit an explicit integration decision. */
final class ConsentManager {
	/**
	 * Return site-level tool hints, never visitor consent cookies.
	 *
	 * @return list<string>
	 */
	public function tools(): array {
		$plugins = (array) get_option( 'active_plugins', array() );
		if ( is_multisite() ) {
			$plugins = array_merge( $plugins, array_keys( (array) get_site_option( 'active_sitewide_plugins', array() ) ) );
		}
		$known = array(
			'wp-consent-api/'    => 'wp-consent-api',
			'cookiebot/'         => 'cookiebot',
			'complianz-gdpr'     => 'complianz',
			'cookie-law-info/'   => 'cookieyes',
			'borlabs-cookie/'    => 'borlabs',
			'real-cookie-banner' => 'real-cookie-banner',
		);
		$tools = array();
		foreach ( $plugins as $plugin ) {
			foreach ( $known as $prefix => $tool ) {
				if ( is_string( $plugin ) && 0 === strpos( $plugin, $prefix ) ) {
					$tools[] = $tool;
				}
			}
		}
		if ( function_exists( 'wp_has_consent' ) ) {
			$tools[] = 'wp-consent-api';
		}
		if ( function_exists( 'cmplz_has_consent' ) ) {
			$tools[] = 'complianz';
		}
		return array_values( array_unique( array_filter( (array) apply_filters( 'pixelpair_consent_tools', $tools ), 'is_string' ) ) );
	}
	/**
	 * Build visitor-neutral browser consent configuration.
	 *
	 * @return array<string,mixed>
	 */
	public function config(): array {
		$settings = ( new Repository() )->get();
		return array(
			'tools'              => $this->tools(),
			'required'           => $settings['deny_until_consent'],
			'statistics_blocked' => ! $settings['strict_cache_mode'] && false === $this->override( 'statistics' ),
			'borlabs_marketing'  => $settings['borlabs_marketing'],
			'borlabs_statistics' => $settings['borlabs_statistics'],
			'rcb_marketing'      => $settings['rcb_marketing'],
			'rcb_statistics'     => $settings['rcb_statistics'],
		);
	}
	/**
	 * Get an optional explicit server policy decision.
	 *
	 * @param string $category Consent category.
	 * @return bool|null Null leaves the detected-tool policy in control.
	 */
	public function override( string $category = 'marketing' ): ?bool {
		$value = 'statistics' === $category ? apply_filters( 'pixelpair_consent_statistics', null ) : apply_filters( 'pixelpair_consent_marketing', null );
		return is_bool( $value ) ? $value : null;
	}
	/**
	 * Apply server policy to an optional browser decision at the public gate.
	 *
	 * @param array{granted?: bool, source?: string} $browser Browser-only consent state, never identity.
	 * @return bool
	 */
	public function allows_marketing( array $browser = array() ): bool {
		return $this->allows( 'marketing', $browser );
	}
	/**
	 * Service operation.
	 *
	 * @param string              $category Category.
	 * @param array<string,mixed> $browser Browser decision.
	 * @return bool
	 */
	public function allows( string $category, array $browser = array() ): bool {
		$override = $this->override( $category );
		if ( null !== $override ) {
			return $override && ( ! isset( $browser['granted'] ) || $browser['granted'] );
		}
		$tools    = $this->tools();
		$required = ( new Repository() )->get()['deny_until_consent'];
		if ( array() === $browser ) {
			return ! $required && array() === $tools;
		}
		if ( empty( $browser['granted'] ) ) {
			return false;
		}
		$source = $browser['source'] ?? '';
		if ( 'default' === $source ) {
			return ! $required && array() === $tools;
		}
		return in_array( $source, array( 'integration', 'wp-consent-api' ), true ) || ( in_array( $source, array( 'cookiebot', 'cookieyes', 'complianz', 'borlabs', 'real-cookie-banner' ), true ) && ( array() === $tools || in_array( $source, $tools, true ) ) );
	}
}
