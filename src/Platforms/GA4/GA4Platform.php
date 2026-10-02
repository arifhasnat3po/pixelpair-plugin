<?php
/**
 * GA4 browser adapter.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\GA4;

use PixelPair\Events\Event;
use PixelPair\Platforms\PlatformInterface;
use PixelPair\Settings\Repository;
/** Emit inert public configuration for the shared Google runtime. */
final class GA4Platform implements PlatformInterface {
	/** Return the adapter key. */
	public function id(): string {
		return 'ga4';
	}
	/** Require explicit owner enablement. */
	public function is_enabled(): bool {
		return ( new Repository() )->get()['ga4_enabled'];
	}
	/** Emit validated public configuration. */
	public function render_base_code(): void {
		$s = ( new Repository() )->get();
	 // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Validated public JSON captured by EventManager.
		echo wp_json_encode(
			array(
				'enabled'    => $this->is_enabled(),
				'ids'        => $s['ga4_ids'],
				'layer'      => $s['google_data_layer'],
				'server_url' => $s['ga4_server_url'],
				'debug'      => $s['ga4_debug'],
			),
			JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
		);
	}
	/**
	 * Service operation.
	 *
	 * @param Event $event Internal envelope.
	 * @return array<string,mixed>|null
	 */
	public function map_event( Event $event ): ?array {
		return \PixelPair\Events\Mapping::event( $event, 'ga4' );
	}
	/** GA4 uses the browser transport. */
	public function supports_server_side(): bool {
		return false;
	}
	/**
	 * Service operation.
	 *
	 * @param Event $event Browser-only adapter.
	 */
	public function send_server_event( Event $event ): void {}
}
