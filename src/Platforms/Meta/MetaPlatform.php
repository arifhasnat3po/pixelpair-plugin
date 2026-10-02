<?php
/**
 * Meta browser PageView adapter.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\Meta;

use PixelPair\Events\Event;
use PixelPair\Platforms\PlatformInterface;
use PixelPair\Settings\Repository;

/** Map Meta events and expose public pixel configuration. */
final class MetaPlatform implements PlatformInterface {
	/** Return the adapter key. */
	public function id(): string {
		return 'meta';
	}
	/** Require validated settings and explicit enablement. */
	public function is_enabled(): bool {
		return ( new Repository() )->get()['meta_enabled'];
	}
	/** Emit a public JSON fragment; never output an executable pixel snippet. */
	public function render_base_code(): void {
		if ( ! $this->is_enabled() ) {
			return;
		}
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Only validated public values, encoded for an inline JSON context.
		echo wp_json_encode(
			array(
				'enabled'  => true,
				'pixel_id' => ( new Repository() )->get()['meta_pixel_id'],
			),
			JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
		);
	}
	/**
	 * Return the supported browser event template, excluding matching data.
	 *
	 * @param Event $event Internal event.
	 * @return array{name: string, params: array<string, mixed>}|null
	 */
	public function map_event( Event $event ): ?array {
		return \PixelPair\Events\Mapping::event( $event, 'meta' );
	}
	/** Report whether server delivery is enabled. */
	public function supports_server_side(): bool {
		return ( new Repository() )->get()['meta_capi_enabled'];
	}
	/**
	 * Queue eligible Meta server events.
	 *
	 * @param Event $event Unused event envelope.
	 */
	public function send_server_event( Event $event ): void {
		if ( $this->supports_server_side() ) {
			( new \PixelPair\Events\Queue() )->enqueue( $event );
		}
	}
}
