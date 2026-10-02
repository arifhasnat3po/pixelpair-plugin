<?php
/**
 * Comment automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the comment event independently of its browser transport. */
final class Comment {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'comment',
			'label'        => __( 'Comment', 'pixelpair' ),
			'meta'         => 'Comment',
			'ga4'          => 'comment',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
