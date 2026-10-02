<?php
/**
 * Signup automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the sign_up event independently of its browser transport. */
final class Signup {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'sign_up',
			'label'        => __( 'Signup', 'pixelpair' ),
			'meta'         => 'CompleteRegistration',
			'ga4'          => 'sign_up',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
