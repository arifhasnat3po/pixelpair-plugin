<?php
/**
 * Public settings schema. Contains no secret fields.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Settings;

/** Describe settings without asking REST to coerce raw input. */
final class Schema {

	/**
	 * Return documentation metadata for the settings object.
	 *
	 * @return array<string, mixed>
	 */
	public static function rest_schema(): array {
		$properties = array();
		foreach ( Defaults::all() as $key => $default ) {
			$properties[ $key ] = array( 'type' => is_bool( $default ) ? 'boolean' : ( is_int( $default ) ? 'integer' : ( is_array( $default ) ? 'array' : 'string' ) ) );
			if ( is_array( $default ) ) {
				$properties[ $key ]['items'] = array( 'type' => 'string' );
			}
		}
		$properties['meta_pixel_id']['pattern'] = '^([0-9]{15,16})?$';
		$properties['automatic_events']         = array( 'type' => 'object' );
		$properties['woocommerce']              = array( 'type' => 'object' );
		$properties['edd']                      = array( 'type' => 'object' );
		foreach ( array( 'scroll_thresholds', 'time_thresholds' ) as $key ) {
			$properties[ $key ]['items'] = array( 'type' => 'integer' );
		}
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => $properties,
		);
	}
}
