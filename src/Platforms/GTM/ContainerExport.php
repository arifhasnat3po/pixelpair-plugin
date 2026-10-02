<?php
/**
 * Portable GTM web-container starter.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Platforms\GTM;

/** Prewire native GA4 tags to PixelPair's documented data-layer contract. */
final class ContainerExport {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Importable version-two container.
	 */
	public static function build(): array {
		$events    = array(
			'page_view'     => 'page_view',
			'search'        => 'search',
			'form_submit'   => 'generate_lead',
			'sign_up'       => 'sign_up',
			'login'         => 'login',
			'comment'       => 'comment',
			'file_download' => 'file_download',
			'scroll_depth'  => 'scroll',
			'time_on_page'  => 'time_on_page',
			'not_found'     => 'page_not_found',
			'outbound_link' => 'click',
		);
		$variables = array(
			array(
				'variableId' => '1',
				'name'       => 'PixelPair GA4 Measurement ID',
				'type'       => 'c',
				'parameter'  => array( self::parameter( 'value', 'G-REPLACE_ME' ) ),
			),
		);
		$fields    = array(
			'event_id'         => 'pixelpair.event_id',
			'search_term'      => 'pixelpair.params.search_string',
			'form_id'          => 'pixelpair.params.form_id',
			'form_name'        => 'pixelpair.params.form_title',
			'percent_scrolled' => 'pixelpair.params.percent_scrolled',
			'seconds'          => 'pixelpair.params.seconds',
			'link_url'         => 'pixelpair.params.link_url',
			'file_name'        => 'pixelpair.params.file_name',
			'items'            => 'ecommerce.items',
		);
		$rows      = array();
		$id        = 2;
		foreach ( $fields as $name => $path ) {
			$variable    = 'PixelPair ' . $name;
			$variables[] = array(
				'variableId' => (string) $id++,
				'name'       => $variable,
				'type'       => 'v',
				'parameter'  => array(
					self::parameter( 'name', $path ),
					array(
						'type'  => 'INTEGER',
						'key'   => 'dataLayerVersion',
						'value' => '2',
					),
				),
			);
			$rows[]      = array(
				'type' => 'MAP',
				'map'  => array( self::parameter( 'parameter', $name ), self::parameter( 'parameterValue', '{{' . $variable . '}}' ) ),
			);
		}
		$triggers = array();
		$tags     = array();
		$id       = 1;
		foreach ( $events as $internal => $ga ) {
			$controls     = ( new \PixelPair\Settings\Repository() )->get()['automatic_events'][ $internal ];
			$ga           = $controls['platforms']['ga4']['name'];
			$trigger_name = $controls['platforms']['gtm']['name'];
			$triggers[]   = array(
				'triggerId'         => (string) $id,
				'name'              => 'PixelPair ' . $internal,
				'type'              => 'CUSTOM_EVENT',
				'customEventFilter' => array(
					array(
						'type'      => 'EQUALS',
						'parameter' => array( self::parameter( 'arg0', '{{_event}}' ), self::parameter( 'arg1', 'pixelpair_' . $trigger_name ) ),
					),
				),
			);
			// VERIFY: native GA4 event type gaawe; import/Preview remains an external acceptance check.
			$tags[] = array(
				'tagId'           => (string) $id,
				'name'            => 'PixelPair GA4 ' . $ga,
				'type'            => 'gaawe',
				'parameter'       => array(
					self::parameter( 'measurementIdOverride', '{{PixelPair GA4 Measurement ID}}' ),
					self::parameter( 'eventName', $ga ),
					array(
						'type' => 'LIST',
						'key'  => 'eventSettingsTable',
						'list' => $rows,
					),
				),
				'firingTriggerId' => array( (string) $id ),
				'tagFiringOption' => 'ONCE_PER_EVENT',
				'consentSettings' => array(
					'consentStatus' => 'NEEDED',
					'consentType'   => array(
						'type' => 'LIST',
						'list' => array(
							array(
								'type'  => 'TEMPLATE',
								'value' => 'analytics_storage',
							),
						),
					),
				),
			);
			++$id;
		}
		return array(
			'exportFormatVersion' => 2,
			'exportTime'          => gmdate( 'Y-m-d H:i:s' ),
			'containerVersion'    => array(
				'containerVersionId' => '0',
				'container'          => array(
					'name'         => 'PixelPair starter',
					'usageContext' => array( 'WEB' ),
				),
				'tag'                => $tags,
				'trigger'            => $triggers,
				'variable'           => $variables,
			),
		);
	}
	/**
	 * Service operation.
	 *
	 * @param string $key Parameter key.
	 * @param string $value Value.
	 * @return array<string,string>
	 */
	private static function parameter( string $key, string $value ): array {
		return array(
			'type'  => 'TEMPLATE',
			'key'   => $key,
			'value' => $value,
		);
	}
}
