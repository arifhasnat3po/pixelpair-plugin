<?php
/**
 * Form submit automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the form_submit event independently of its browser transport. */
final class FormSubmit {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'form_submit',
			'label'        => __( 'Form submit', 'pixelpair' ),
			'meta'         => 'Lead',
			'ga4'          => 'generate_lead',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
