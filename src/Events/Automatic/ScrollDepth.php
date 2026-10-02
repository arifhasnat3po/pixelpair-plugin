<?php
/**
 * Scroll depth automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the scroll_depth event independently of its browser transport. */
final class ScrollDepth {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'scroll_depth',
			'label'        => __( 'Scroll depth', 'pixelpair' ),
			'meta'         => 'ScrollDepth',
			'ga4'          => 'scroll',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
