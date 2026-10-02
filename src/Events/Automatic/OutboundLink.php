<?php
/**
 * Outbound link automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the outbound_link event independently of its browser transport. */
final class OutboundLink {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'outbound_link',
			'label'        => __( 'Outbound link', 'pixelpair' ),
			'meta'         => 'OutboundClick',
			'ga4'          => 'click',
			'enabled'      => false,
			'meta_enabled' => true,
		);
	}
}
