<?php
/**
 * Time on page automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the time_on_page event independently of its browser transport. */
final class TimeOnPage {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'time_on_page',
			'label'        => __( 'Time on page', 'pixelpair' ),
			'meta'         => 'TimeOnPage',
			'ga4'          => 'time_on_page',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
