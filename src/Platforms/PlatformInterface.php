<?php
/**
 * Contract for marketing platform adapters.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms;

use PixelPair\Events\Event;

/** Provide inert base configuration and platform event mapping. */
interface PlatformInterface {
	/** Return the stable adapter key. */
	public function id(): string;
	/** Whether an owner has enabled a valid configuration. */
	public function is_enabled(): bool;
	/** Output an inert JSON fragment, captured by EventManager. */
	public function render_base_code(): void;
	/**
	 * Map a supported event.
	 *
	 * @param Event $event Platform-neutral event.
	 * @return array<string, mixed>|null
	 */
	public function map_event( Event $event ): ?array;
	/** Whether server transport is available. */
	public function supports_server_side(): bool;
	/**
	 * Send a server event when supported by the platform.
	 *
	 * @param Event $event Platform-neutral event.
	 */
	public function send_server_event( Event $event ): void;
}
