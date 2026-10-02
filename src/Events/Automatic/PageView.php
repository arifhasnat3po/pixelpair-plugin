<?php
/**
 * Page view automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the page_view event independently of its browser transport. */
final class PageView {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'page_view',
			'label'        => __( 'Page view', 'pixelpair' ),
			'meta'         => 'PageView',
			'ga4'          => 'page_view',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
