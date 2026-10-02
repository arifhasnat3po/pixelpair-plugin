<?php
/**
 * Automatic event settings and mapping registry.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Defaults are shared by settings validation, dispatch and the admin. */
final class Registry {
	/**
	 * Service operation.
	 *
	 * @return array<string,array<string,mixed>> Default event controls.
	 */
	public static function defaults(): array {
		$out = array();
		foreach ( array( PageView::class, Search::class, FormSubmit::class, Signup::class, Login::class, Comment::class, FileDownload::class, ScrollDepth::class, TimeOnPage::class, NotFound::class, OutboundLink::class ) as $class ) {
			$d                = $class::definition();
			$out[ $d['key'] ] = array(
				'enabled'   => $d['enabled'],
				'platforms' => array(
					'tiktok' => array(
						'enabled' => $d['meta_enabled'],
						'name'    => array(
							'page_view'     => 'PageView',
							'search'        => 'Search',
							'form_submit'   => 'SubmitForm',
							'sign_up'       => 'CompleteRegistration',
							'file_download' => 'Download',
						)[ $d['key'] ] ?? $d['meta'],
						'params'  => array(),
						'server'  => true,
					),
					'meta'   => array(
						'enabled' => $d['meta_enabled'],
						'name'    => $d['meta'],
						'params'  => array(),
						'server'  => true,
					),
					'ga4'    => array(
						'enabled' => true,
						'name'    => $d['ga4'],
						'params'  => array(),
						'server'  => false,
					),
					'gtm'    => array(
						'enabled' => $d['meta_enabled'],
						'name'    => $d['key'],
						'params'  => array(),
						'server'  => false,
					),
				),
			);
		}return $out;
	}
	/**
	 * Service operation.
	 *
	 * @param string $key Event key.
	 * @param string $platform Adapter.
	 * @return array<string,mixed>|null
	 */
	public static function mapping( string $key, string $platform ): ?array {
		$settings = ( new \PixelPair\Settings\Repository() )->get();
		$event    = $settings['automatic_events'][ $key ] ?? null;
		return is_array( $event ) && $event['enabled'] && ! empty( $event['platforms'][ $platform ]['enabled'] ) ? $event['platforms'][ $platform ] : null;
	}
	/**
	 * Service operation.
	 *
	 * @return array<string,string> Translated labels.
	 */
	public static function labels(): array {
		return array(
			'page_view'     => __( 'Page view', 'pixelpair' ),
			'search'        => __( 'Search', 'pixelpair' ),
			'form_submit'   => __( 'Form submit', 'pixelpair' ),
			'sign_up'       => __( 'Signup', 'pixelpair' ),
			'login'         => __( 'Login', 'pixelpair' ),
			'comment'       => __( 'Comment', 'pixelpair' ),
			'file_download' => __( 'File download', 'pixelpair' ),
			'scroll_depth'  => __( 'Scroll depth', 'pixelpair' ),
			'time_on_page'  => __( 'Time on page', 'pixelpair' ),
			'not_found'     => __( '404 page', 'pixelpair' ),
			'outbound_link' => __( 'Outbound link', 'pixelpair' ),
		);
	}
}
