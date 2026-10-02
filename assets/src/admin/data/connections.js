import { __ } from '@wordpress/i18n';

export const providers = {
	meta: {
		name: __( 'Meta', 'pixelpair' ),
		field: 'meta_pixel_id',
		server: true,
	},
	ga4: { name: __( 'Google Analytics', 'pixelpair' ), field: 'ga4_ids' },
	gtm: { name: __( 'Tag Manager', 'pixelpair' ), field: 'gtm_id' },
	tiktok: {
		name: __( 'TikTok', 'pixelpair' ),
		field: 'tiktok_pixel_id',
		server: true,
	},
};

export function configuredPlatforms( platforms, settings ) {
	return platforms
		? {
				...platforms,
				gtm: {
					...platforms.gtm,
					data_layer_only: !! settings.gtm_data_layer_only,
				},
			}
		: null;
}

export function connectionStatus( value = {} ) {
	let text = __( 'Not set up', 'pixelpair' );
	let action = __( 'Set up', 'pixelpair' );
	let status = 'neutral';
	if ( value.id_set ) {
		text = __( 'Tracking off', 'pixelpair' );
		action = __( 'Manage', 'pixelpair' );
	}
	if ( value.enabled ) {
		text = value.server_enabled
			? __( 'Browser and server configured', 'pixelpair' )
			: __( 'Browser configured', 'pixelpair' );
		status = 'info';
		action = __( 'Manage', 'pixelpair' );
		if ( value.data_layer_only ) {
			text = __( 'Data layer configured', 'pixelpair' );
		} else if ( ! value.id_set ) {
			text = __( 'Connection ID needed', 'pixelpair' );
			status = 'error';
		} else if ( value.server_enabled && ! value.credentials_set ) {
			text = __( 'Access token needed', 'pixelpair' );
			status = 'error';
		} else if (
			value.server_enabled &&
			[ 'failed', 'retry' ].includes( value.last_event?.status )
		) {
			text = __( 'Server delivery failed', 'pixelpair' );
			status = 'error';
		} else if (
			value.server_enabled &&
			value.last_event?.status === 'sent'
		) {
			text = __( 'Server accepted the last event', 'pixelpair' );
			status = 'success';
		}
	}
	if ( status === 'error' ) {
		action = __( 'Fix', 'pixelpair' );
	}
	return { text, action, status };
}
