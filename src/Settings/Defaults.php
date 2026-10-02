<?php
/**
 * Default settings for the current schema.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Settings;

/** Define the initial site settings. */
final class Defaults {
	/**
	 * Return site-scoped settings without secrets.
	 *
	 * @return array<string, mixed>
	 */
	public static function all(): array {
		return array(
			'onboarding_complete'      => false,
			'debug_enabled'            => false,
			'debug_hide_name'          => false,
			'tiktok_enabled'           => false,
			'tiktok_pixel_id'          => '',
			'tiktok_capi_enabled'      => false,
			'tiktok_advanced_matching' => false,
			'woocommerce'              => \PixelPair\Commerce\Settings::defaults(),
			'edd'                      => \PixelPair\Commerce\Settings::defaults(),
			'automatic_events'         => \PixelPair\Events\Automatic\Registry::defaults(),
			'scroll_thresholds'        => array( 25, 50, 75, 90 ),
			'time_thresholds'          => array( 30, 60, 120 ),
			'download_extensions'      => array( 'pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'mp3', 'mp4', 'epub' ),
			'context_parameters'       => array( 'page_title', 'post_type', 'post_id', 'categories', 'tags', 'landing_page', 'traffic_source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content' ),
			'capture_form_fields'      => false,
			'ga4_enabled'              => false,
			'ga4_ids'                  => array(),
			'ga4_server_url'           => '',
			'ga4_debug'                => false,
			'google_data_layer'        => 'pixelpairDataLayer',
			'google_consent_denied'    => false,
			'google_wait_for_update'   => 500,
			'gtm_enabled'              => false,
			'gtm_id'                   => '',
			'gtm_server_url'           => '',
			'gtm_data_layer'           => 'pixelpairDataLayer',
			'gtm_data_layer_only'      => false,
			'borlabs_marketing'        => '',
			'borlabs_statistics'       => '',
			'rcb_marketing'            => '',
			'rcb_statistics'           => '',
			'meta_enabled'             => false,
			'meta_pixel_id'            => '',
			'meta_capi_enabled'        => false,
			'meta_advanced_matching'   => false,
			'meta_ldu'                 => false,
			'meta_sensitive_data'      => false,
			'trust_proxy'              => false,
			'logging_enabled'          => false,
			'log_retention_days'       => 7,
			'excluded_roles'           => array(),
			'excluded_ips'             => array(),
			'exclude_bots'             => true,
			'strict_cache_mode'        => false,
			'deny_until_consent'       => false,
			'consent_notice_dismissed' => false,
			'keep_data_on_uninstall'   => false,
		);
	}
}
