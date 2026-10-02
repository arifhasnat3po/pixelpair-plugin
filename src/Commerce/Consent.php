<?php
/**
 * Consent and bounded attribution snapshots for store callbacks.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Commerce;

use PixelPair\Integrations\Consent\ConsentManager;
use PixelPair\Exclusions\ExclusionManager;
use PixelPair\Support\Request;
/**
 * Transport category decisions, never authorization or customer identifiers.
 */
final class Consent {
	/** Recheck a known order's current owner, payment and consent before background work.
	 *
	 * @param string $key Provider-qualified purchase identity.
	 * @return bool
	 */
	public static function order_allowed( string $key ): bool {
		if ( ! preg_match( '/\A(woo|edd):purchase:([1-9][0-9]*)\z/', $key, $parts ) ) {
			return false; }
		if ( 'woo' === $parts[1] && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( (int) $parts[2] );
			if ( ! $order || ! $order->is_paid() || ! ( new \PixelPair\Integrations\WooCommerce\Integration() )->renewal_allowed( $order ) ) {
				return false; }
			$user_id = $order->get_customer_id();
			$context = \PixelPair\Integrations\WooCommerce\Integration::context( $order );
		} elseif ( 'edd' === $parts[1] && function_exists( 'edd_get_order' ) ) {
			$order = edd_get_order( (int) $parts[2] );
			if ( ! $order || ! \PixelPair\Integrations\EDD\Integration::paid( $order ) ) {
				return false; }
			$user_id = (int) $order->user_id;
			$context = \PixelPair\Integrations\EDD\Integration::context( $order );
		} else {
			return false; }
		$settings = ( new \PixelPair\Settings\Repository() )->get();
		$user     = $user_id ? get_userdata( $user_id ) : false;
		return ( ! $user_id || ( $user && ! array_intersect( $user->roles, $settings['excluded_roles'] ) ) ) && self::retained( $context, 'marketing' );
	}
	/** Persist a decision received on an authorized receipt; never restore forbidden matching.
	 *
	 * @param string              $provider Provider.
	 * @param object              $order Authorized order.
	 * @param array<string,mixed> $current Fresh decision and matching.
	 * @return array<string,mixed>
	 */
	public static function receipt( string $provider, $order, array $current ): array {
		$saved = 'woo' === $provider ? \PixelPair\Integrations\WooCommerce\Integration::context( $order ) : \PixelPair\Integrations\EDD\Integration::context( $order );
		$next  = $saved;
		foreach ( array( 'marketing', 'statistics' ) as $category ) {
			if ( ! empty( $saved[ $category . '_revoked' ] ) || ( ! empty( $current[ $category . '_resolved' ] ) && empty( $current[ $category ] ) ) ) {
				$current[ $category ]           = false;
				$next[ $category ]              = false;
				$next[ $category . '_revoked' ] = true;
			}
		}
		foreach ( array(
			'meta'   => 'matching',
			'tiktok' => 'tiktok_matching',
		) as $platform => $field ) {
			if ( empty( $current['marketing'] ) ) {
				unset( $current[ $field ] );
				continue; }
			$data              = self::retained( $saved, 'marketing' ) && ! empty( $saved[ $field ] ) ? $saved[ $field ] : ( $current[ $field ] ?? array() );
			$current[ $field ] = \PixelPair\UserData\Collector::permitted( (array) $data, $platform );
		}
		if ( ! empty( $next['marketing_revoked'] ) ) {
			unset( $next['matching'], $next['tiktok_matching'] ); }
		$encrypted = \PixelPair\Support\Crypto::encrypt( (string) wp_json_encode( $next ) );
		$id        = 'woo' === $provider ? $order->get_id() : (int) $order->id;
		// Receipt grants do not overwrite checkout consent or race a received withdrawal.
		if ( $next !== $saved ) {
			if ( 'woo' === $provider ) {
				$order->update_meta_data( '_pixelpair_context', $encrypted );
				$order->save(); } else {
				edd_update_order_meta( $id, '_pixelpair_context', $encrypted ); }
		}
		if ( ! empty( $next['marketing_revoked'] ) ) {
			\PixelPair\Events\Queue::erase_subject( $provider . ':purchase:' . $id ); }
		return $current;
	}

	/**
	 * Provide validated commerce data.
	 *
	 * @param array<string,mixed>|null $browser Explicit current browser decisions.
	 * @return array<string,mixed> Current consented context.
	 */
	public static function current( ?array $browser = null ): array {
		if ( null === $browser ) {
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Bounded JSON and its two decision shapes are validated below.
			$raw     = \PixelPair\Settings\Migrations::cookie( 'pixelpair_commerce_consent' );
			$browser = is_string( $raw ) && strlen( $raw ) <= 1024 ? json_decode( $raw, true ) : array();
			$browser = is_array( $browser ) ? $browser : array();
		}
		$manager  = new ConsentManager();
		$source   = home_url( '/' );
		$out      = array(
			'marketing'   => false,
			'statistics'  => false,
			'source_url'  => $source,
			'captured_at' => time(),
		);
		$eligible = ( new ExclusionManager() )->should_track( $source );
		foreach ( array( 'marketing', 'statistics' ) as $category ) {
			$decision = $browser[ $category ] ?? array();
			if ( ! is_array( $decision ) || array_diff( array_keys( $decision ), array( 'granted', 'source' ) ) || ( isset( $decision['granted'] ) && ! is_bool( $decision['granted'] ) ) || ( isset( $decision['source'] ) && ! is_string( $decision['source'] ) ) ) {
				continue;
			}
			$out[ $category ]               = $eligible && $manager->allows( $category, $decision );
			$out[ $category . '_resolved' ] = isset( $decision['granted'], $decision['source'] ) && 'unresolved' !== $decision['source'];
			if ( function_exists( 'wp_get_consent_type' ) && function_exists( 'wp_has_consent' ) && in_array( call_user_func( 'wp_get_consent_type' ), array( 'optin', 'optout' ), true ) ) {
				$out[ $category ] = $out[ $category ] && (bool) call_user_func( 'wp_has_consent', $category );
			}
		}
		if ( $out['marketing'] ) {
			if ( ( new \PixelPair\Settings\Repository() )->get()['meta_enabled'] ) {
				$out['matching'] = ( new \PixelPair\UserData\Collector() )->collect( $source );}
			if ( ( new \PixelPair\Settings\Repository() )->get()['tiktok_enabled'] ) {
				$out['tiktok_matching'] = ( new \PixelPair\UserData\Collector() )->collect( $source, 'tiktok' ); }
		}
		return $out;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param array<string,mixed> $values Browser attribution.
	 * @param bool                $marketing Marketing grant.
	 * @return array<string,string> Allowlisted attribution.
	 */
	public static function attribution( array $values, bool $marketing ): array {
		$out  = array();
		$keys = array( 'landing_page', 'traffic_source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content' );
		if ( $marketing ) {
			$keys = array_merge( $keys, array( 'fbclid', 'ttclid', 'gclid' ) );
		}
		foreach ( $keys as $key ) {
			$v = $values[ $key ] ?? null;
			if ( ! is_string( $v ) ) {
				continue;
			}
			$v = mb_substr( sanitize_text_field( $v ), 0, 256 );
			if ( 'landing_page' === $key ) {
				$parts = wp_parse_url( $v );
				$v     = is_array( $parts ) && isset( $parts['host'] ) ? ( $parts['scheme'] ?? 'https' ) . '://' . $parts['host'] . ( $parts['path'] ?? '/' ) : '';
			}
			$out[ $key ] = $v;
		}
		return $out;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param array<string,mixed> $context Captured context.
	 * @param string              $category Category.
	 * @return bool Background dispatch allowed.
	 */
	public static function retained( array $context, string $category ): bool {
		return true === ( $context[ $category ] ?? false ) && (int) ( $context['captured_at'] ?? 0 ) > time() - 30 * DAY_IN_SECONDS && false !== ( new ConsentManager() )->override( $category );
	}
}
