<?php
/**
 * Search automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the search event independently of its browser transport. */
final class Search {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'search',
			'label'        => __( 'Search', 'pixelpair' ),
			'meta'         => 'Search',
			'ga4'          => 'search',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
