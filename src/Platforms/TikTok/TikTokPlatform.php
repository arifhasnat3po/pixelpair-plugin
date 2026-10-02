<?php
/**
 * TikTok browser and server adapter.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Platforms\TikTok;

use PixelPair\Events\Event;
use PixelPair\Settings\Repository;
/**
 * Public settings contain no credentials.
 */
final class TikTokPlatform implements \PixelPair\Platforms\PlatformInterface {

	/** Return the platform key. */
	public function id(): string {
		return 'tiktok';
	}
	/** Require explicit platform enablement. */
	public function is_enabled(): bool {
		return ( new Repository() )->get()['tiktok_enabled'];
	}
	/** Emit only public adapter configuration. */
	public function render_base_code(): void {
		$s = ( new Repository() )->get();
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Public values encoded for JSON context.
		echo wp_json_encode(
			array(
				'enabled'           => $s['tiktok_enabled'],
				'pixel_id'          => $s['tiktok_pixel_id'],
				'server'            => $s['tiktok_capi_enabled'],
				'advanced_matching' => $s['tiktok_advanced_matching'],
				'identity_url'      => add_query_arg( 'platform', 'tiktok', rest_url( 'pixelpair/v1/identity' ) ),
				'script_url'        => Config::SCRIPT_URL,
			),
			JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param Event $event Validated internal event.
	 * @return array<string,mixed>|null
	 */
	public function map_event( Event $event ): ?array {
		return \PixelPair\Events\Mapping::event( $event, 'tiktok' );
	}
	/** Check the server transport toggle. */
	public function supports_server_side(): bool {
		return ( new Repository() )->get()['tiktok_capi_enabled'];
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param Event $event Consented internal event.
	 */
	public function send_server_event( Event $event ): void {
		if ( $this->supports_server_side() ) {
			( new \PixelPair\Events\Queue() )->enqueue( $event, 'tiktok' );
		}
	}
}
