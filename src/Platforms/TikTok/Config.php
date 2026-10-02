<?php
/**
 * TikTok fixed transport configuration.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Platforms\TikTok;

/**
 * Official Events API v1.3 and browser SDK.
 */
final class Config {

	/** VERIFY: Official TikTok GTM Events API template, checked 2026-10-02. */
	const API_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
	/** VERIFY: Official Pixel cookie consent documentation, checked 2026-10-02. */
	const SCRIPT_URL = 'https://analytics.tiktok.com/i18n/pixel/events.js';
}
