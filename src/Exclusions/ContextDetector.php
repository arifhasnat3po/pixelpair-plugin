<?php
/**
 * Non-public and editing contexts.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Exclusions;

/** Keep tracking out of editors, previews, APIs and AMP. */
final class ContextDetector {
	/** Return whether the currently rendered request is excluded. */
	public function is_excluded(): bool {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || is_preview() || is_customize_preview() || is_feed() ) {
			return true;
		}
		// VERIFY: official API/source references and fixture limitations are in docs/testing-meta.md.
		foreach ( array( 'bricks_is_builder', 'is_amp_endpoint', 'amp_is_request' ) as $function ) {
			if ( $this->active_function( $function ) ) {
				return true;
			}
		}
		if ( is_callable( array( 'FLBuilderModel', 'is_builder_active' ) ) && call_user_func( array( 'FLBuilderModel', 'is_builder_active' ) ) ) {
			return true;
		}
		if ( class_exists( '\Elementor\Plugin' ) ) {
			$plugin = \Elementor\Plugin::$instance;
			foreach ( array(
				'editor'  => 'is_edit_mode',
				'preview' => 'is_preview_mode',
			) as $service => $method ) {
				if ( isset( $plugin->$service ) && is_callable( array( $plugin->$service, $method ) ) && $plugin->$service->$method() ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Query a documented optional integration without requiring that plugin.
	 *
	 * @param string $callback Optional function name.
	 * @return bool
	 */
	private function active_function( string $callback ): bool {
		return is_callable( $callback ) && (bool) $callback();
	}
	/**
	 * Evaluate a public source URL separately from the Ajax endpoint's context.
	 *
	 * @param string $url Validated source URL.
	 * @return bool
	 */
	public function excluded_url( string $url ): bool {
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return true;
		}
		$path = rawurldecode( $parts['path'] ?? '/' );
		if ( preg_match( '~/(?:wp-admin|wp-json)(?:/|$)|/(?:wp-login|wp-cron)\.php$|/amp/?$~i', $path ) ) {
			return true;
		}
		parse_str( $parts['query'] ?? '', $query );
		// These documented editor URL signals only suppress tracking; they confer no access.
		foreach ( array( 'rest_route', 'preview', 'elementor-preview', 'et_fb', 'ct_builder', 'fl_builder', 'amp', 'customize_changeset_uuid' ) as $key ) {
			if ( array_key_exists( $key, $query ) ) {
				return true;
			}
		}
		return isset( $query['bricks'] ) && 'run' === $query['bricks'];
	}
}
