/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, Fragment } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import BrowserConnection from '../components/BrowserConnection';
import { TextField, CheckField } from '../components/ui/fields';
import { validServerUrl, validDataLayer } from '../data/validation';

const keys = [ 'ga4_server_url', 'google_data_layer', 'ga4_debug' ];
const validate = ( values ) => ( {
	ga4_server_url:
		! validServerUrl( values.ga4_server_url ) &&
		__(
			'Use an HTTPS URL without a username, password, query or fragment.',
			'pixelpair'
		),
	google_data_layer:
		! validDataLayer( values.google_data_layer ) &&
		__(
			'Use a unique JavaScript name, up to 64 characters. Avoid reserved names such as window.',
			'pixelpair'
		),
} );
function advanced( draft, errors ) {
	return (
		<Fragment>
			<TextField
				label={ __( 'Server container URL', 'pixelpair' ) }
				type="url"
				value={ draft.values.ga4_server_url }
				onChange={ ( value ) =>
					draft.change( 'ga4_server_url', value )
				}
				error={ errors.ga4_server_url }
				help={ __(
					'Optional HTTPS address for your server-side Google tag container.',
					'pixelpair'
				) }
			/>
			<TextField
				label={ __( 'Data layer name', 'pixelpair' ) }
				value={ draft.values.google_data_layer }
				onChange={ ( value ) =>
					draft.change( 'google_data_layer', value )
				}
				error={ errors.google_data_layer }
				help={ __(
					'Use the same name as your existing Google tags.',
					'pixelpair'
				) }
			/>
			<CheckField
				label={ __( 'Debug mode', 'pixelpair' ) }
				checked={ draft.values.ga4_debug }
				onChange={ ( value ) => draft.change( 'ga4_debug', value ) }
				help={ __(
					'Mark events for Google Analytics DebugView while testing.',
					'pixelpair'
				) }
			/>
		</Fragment>
	);
}
export default function GoogleAnalytics( props ) {
	return (
		<BrowserConnection
			platform="ga4"
			keys={ keys }
			validate={ validate }
			advanced={ advanced }
			{ ...props }
		/>
	);
}
