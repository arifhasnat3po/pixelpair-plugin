<?php
/**
 * Login automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the login event independently of its browser transport. */
final class Login {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'login',
			'label'        => __( 'Login', 'pixelpair' ),
			'meta'         => 'Login',
			'ga4'          => 'login',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
