<?php
/**
 * Cache-conscious public configuration and deferred tracker delivery.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

use PixelPair\Exclusions\BotDetector;
use PixelPair\Exclusions\ContextDetector;
use PixelPair\Exclusions\ExclusionManager;
use PixelPair\Integrations\Consent\ConsentManager;
use PixelPair\Platforms\PlatformInterface;
use PixelPair\Platforms\Meta\MetaPlatform;
use PixelPair\Platforms\Meta\Config;
use PixelPair\Settings\Repository;
use PixelPair\Support\Request;

/** Collect public platform configuration without visitor identifiers. */
final class EventManager {
	/**
	 * Registered adapters.
	 *
	 * @var array<string, PlatformInterface>
	 */
	private $platforms = array();
	/** Register the browser event adapter. */
	public function __construct() {
		$this->register_platform( new MetaPlatform() );
		$this->register_platform( new \PixelPair\Platforms\TikTok\TikTokPlatform() );
		$this->register_platform( new \PixelPair\Platforms\GA4\GA4Platform() );
		$this->register_platform( new \PixelPair\Platforms\GTM\GTMPlatform() );
	}
	/**
	 * Register or replace a platform adapter.
	 *
	 * @param PlatformInterface $platform Adapter.
	 */
	public function register_platform( PlatformInterface $platform ): void {
		$this->platforms[ $platform->id() ] = $platform;
	}
	/**
	 * Build configuration. Null means no tracker should be emitted.
	 *
	 * @return array<string, mixed>|null
	 */
	public function configuration(): ?array {
		$settings = ( new Repository() )->get();
		$context  = new ContextDetector();
		$source   = home_url() . '/' . ltrim( Request::server( 'REQUEST_URI' ), '/' );
		if ( $context->is_excluded() || $context->excluded_url( $source ) || ( ! $settings['strict_cache_mode'] && ! ( new ExclusionManager() )->should_track( $source, true ) ) ) {
			return null;
		}
		$public = $this->platform_config();
		if ( ! $public ) {
			return null;
		}
		$consent = new ConsentManager();
		$policy  = $consent->config();
		if ( ! $settings['strict_cache_mode'] && false === $consent->override() ) {
			$policy['blocked'] = true;
		}
		return array(
			'debug_url'           => $settings['debug_enabled'] ? admin_url( 'admin-ajax.php?action=pixelpair_debug', 'relative' ) : '',
			'migration'           => \PixelPair\Settings\Migrations::browser_keys(),
			'commerce'            => \PixelPair\Commerce\Controller::configuration(),
			'automatic'           => $settings['automatic_events'],
			'rules'               => array_values( ( new Custom\Repository() )->rules() ),
			'page'                => Automatic\Context::page(),
			'scroll_thresholds'   => $settings['scroll_thresholds'],
			'time_thresholds'     => $settings['time_thresholds'],
			'download_extensions' => $settings['download_extensions'],
			'context_parameters'  => $settings['context_parameters'],
			'capture_form_fields' => $settings['capture_form_fields'],
			'context_url'         => rest_url( 'pixelpair/v1/context' ),
			'meta_sensitive_data' => $settings['meta_sensitive_data'],
			'capi_enabled'        => $settings['meta_capi_enabled'],
			'advanced_matching'   => $settings['meta_advanced_matching'],
			'identity_url'        => rest_url( 'pixelpair/v1/identity' ),
			'event_url'           => rest_url( 'pixelpair/v1/event' ),
			'meta_ldu'            => (bool) apply_filters( 'pixelpair_meta_ldu', $settings['meta_ldu'], null ),
			'tiktok'              => $public['tiktok'] ?? array( 'enabled' => false ),
			'meta'                => $public['meta'] ?? array( 'enabled' => false ),
			'ga4'                 => $public['ga4'] ?? array( 'enabled' => false ),
			'gtm'                 => $public['gtm'] ?? array( 'enabled' => false ),
			'google_consent'      => array(
				'denied' => (bool) apply_filters( 'pixelpair_google_consent_denied', $settings['google_consent_denied'] ),
				'wait'   => $settings['google_wait_for_update'],
			),
			'meta_script_url'     => Config::SCRIPT_URL,
			'gate'                => array(
				'required' => $settings['strict_cache_mode'] || ! empty( $settings['excluded_ips'] ),
				'url'      => admin_url( 'admin-ajax.php?action=pixelpair_bootstrap', 'relative' ),
			),
			'consent'             => $policy,
			'bots'                => $settings['exclude_bots'] ? BotDetector::patterns() : array(),
		);
	}
	/**
	 * Collect adapter configuration consistently for rendering and the gate.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function platform_config(): array {
		$platforms = (array) apply_filters( 'pixelpair_platforms', $this->platforms );
		$public    = array();
		foreach ( $platforms as $platform ) {
			if ( ! $platform instanceof PlatformInterface || ! $platform->is_enabled() ) {
				continue;
			}
			ob_start();
			$platform->render_base_code();
			$fragment = ob_get_clean();
			$value    = json_decode( (string) $fragment, true );
			if ( is_array( $value ) ) {
				$public[ $platform->id() ] = $value;
			}
		}
		return $public;
	}
	/** Queue one site-level JSON config and one deferred vanilla bundle. */
	public function render_config(): void {
		$config = $this->configuration();
		if ( null === $config || ! is_readable( PIXELPAIR_PATH . 'build/tracker.js' ) || wp_script_is( 'pixelpair-tracker', 'enqueued' ) ) {
			return;
		}
		global $wp_version;
		$args = version_compare( $wp_version, '6.3', '>=' ) ? array(
			'strategy'  => 'defer',
			'in_footer' => true,
		) : true;
		wp_enqueue_script( 'pixelpair-tracker', plugins_url( 'build/tracker.js', PIXELPAIR_FILE ), array(), PIXELPAIR_VERSION, $args );
		add_filter( 'script_loader_tag', array( self::class, 'defer_tag' ), 10, 2 );
		wp_add_inline_script( 'pixelpair-tracker', 'window.pixelpairConfig = ' . wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';', 'before' );
	}
	/** Supply only the consent form bridge on core login/registration pages. */
	public function render_action_consent(): void {
		if ( ! $this->platform_config() || ! is_readable( PIXELPAIR_PATH . 'build/tracker.js' ) ) {
			return;
		}
		$config = array(
			'action_consent_only' => true,
			'consent'             => ( new ConsentManager() )->config(),
		);
		wp_enqueue_script( 'pixelpair-tracker', plugins_url( 'build/tracker.js', PIXELPAIR_FILE ), array(), PIXELPAIR_VERSION, true );
		add_filter( 'script_loader_tag', array( self::class, 'defer_tag' ), 10, 2 );
		wp_add_inline_script( 'pixelpair-tracker', 'window.pixelpairConfig = ' . wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';', 'before' );
	}
	/**
	 * Supply defer on the WordPress 6.2 floor without modifying other handles.
	 *
	 * @param string $tag Script markup.
	 * @param string $handle WordPress script handle.
	 * @return string
	 */
	public static function defer_tag( string $tag, string $handle ): string {
		if ( 'pixelpair-tracker' !== $handle ) {
			return $tag;
		}
		// WordPress 6.2 supplies inline-before and external tags together to this filter.
		return (string) preg_replace_callback(
			'/<script\b[^>]*\bsrc\s*=[^>]*>/i',
			static function ( array $matches ): string {
				return preg_match( '/\sdefer(?:\s|=|>)/', $matches[0] ) ? $matches[0] : (string) preg_replace( '/<script\b/i', '<script defer', $matches[0], 1 );
			},
			$tag,
			1
		);
	}
}
