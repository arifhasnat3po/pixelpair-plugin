<?php
/**
 * 404 page automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the not_found event independently of its browser transport. */
final class NotFound {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'not_found',
			'label'        => __( '404 page', 'pixelpair' ),
			'meta'         => 'PageNotFound',
			'ga4'          => 'page_not_found',
			'enabled'      => true,
			'meta_enabled' => false,
		);
	}
}
