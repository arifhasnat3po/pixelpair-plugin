<?php
/**
 * Central external Meta API constants.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\Meta;

/** Keep external protocol details in one place. */
final class Config {
	// VERIFY: Meta's official facebook-python-business-sdk apiconfig.py, checked 2026-10-01.
	public const GRAPH_VERSION = 'v26.0';
	// VERIFY: https://developers.facebook.com/docs/meta-pixel/get-started and Meta's official Facebook-Pixel-for-Wordpress source; see docs/testing-meta.md.
	const SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js';
}
