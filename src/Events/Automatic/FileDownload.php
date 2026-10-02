<?php
/**
 * File download automatic event definition.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Define the file_download event independently of its browser transport. */
final class FileDownload {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Event definition.
	 */
	public static function definition(): array {
		return array(
			'key'          => 'file_download',
			'label'        => __( 'File download', 'pixelpair' ),
			'meta'         => 'Download',
			'ga4'          => 'file_download',
			'enabled'      => true,
			'meta_enabled' => true,
		);
	}
}
