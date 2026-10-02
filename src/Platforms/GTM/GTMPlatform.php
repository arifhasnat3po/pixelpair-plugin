<?php
/**
 * GTM browser adapter.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\GTM;

use PixelPair\Events\Event;
use PixelPair\Platforms\PlatformInterface;
use PixelPair\Settings\Repository;
/** Emit inert container configuration. */
final class GTMPlatform implements PlatformInterface {
	/** Return the adapter key. */
	public function id(): string {
		return 'gtm';
	}
	/** Require explicit owner enablement. */
	public function is_enabled(): bool {
		return ( new Repository() )->get()['gtm_enabled'];
	}
	/** Emit validated public configuration. */
	public function render_base_code(): void {
		$s = ( new Repository() )->get();
	 // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Validated public JSON captured by EventManager.
		echo wp_json_encode(
			array(
				'enabled'    => $this->is_enabled(),
				'id'         => $s['gtm_id'],
				'layer'      => $s['gtm_data_layer'],
				'server_url' => $s['gtm_server_url'],
				'only'       => $s['gtm_data_layer_only'],
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
		$mapped = \PixelPair\Events\Mapping::event( $event, 'gtm' );
		if ( ! $mapped ) {
			return null;
		}
		return array(
			'event'     => 'pixelpair_' . $mapped['name'],
			'pixelpair' => array(
				'event_id' => $event->event_id,
				'params'   => $mapped['params'],
			),
		);
	}
	/** GTM uses the browser transport. */
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
