/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, Fragment, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import BrowserConnection from '../components/BrowserConnection';
import { TextField, CheckField } from '../components/ui/fields';
import { Button, Feedback } from '../components/ui';
import { validServerUrl, validDataLayer } from '../data/validation';
import { downloadFile } from '../data/download';

const keys = [ 'gtm_server_url', 'gtm_data_layer', 'gtm_data_layer_only' ];
const validate = ( values ) => ( {
	gtm_server_url:
		! validServerUrl( values.gtm_server_url ) &&
		__(
			'Use an HTTPS URL without a username, password, query or fragment.',
			'pixelpair'
		),
	gtm_data_layer:
		! validDataLayer( values.gtm_data_layer ) &&
		__(
			'Use a unique JavaScript name, up to 64 characters. Avoid reserved names such as window.',
			'pixelpair'
		),
} );
function TemplateDownload() {
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );
	const download = async () => {
		setBusy( true );
		setError( '' );
		try {
			const data = await apiFetch( { path: '/pixelpair/v1/gtm-export' } );
			downloadFile(
				'pixelpair-gtm.json',
				JSON.stringify( data, null, 2 )
			);
		} catch {
			setError(
				__(
					'The template could not be downloaded. Try again.',
					'pixelpair'
				)
			);
		} finally {
			setBusy( false );
		}
	};
	return (
		<div>
			<Button
				busy={ busy }
				busyLabel={ __( 'Preparing…', 'pixelpair' ) }
				onClick={ download }
			>
				{ __( 'Download container template', 'pixelpair' ) }
			</Button>
			<p className="pixelpair-help">
				{ __(
					'Import into a new workspace; replace G-REPLACE_ME and review consent before publishing.',
					'pixelpair'
				) }
			</p>
			{ error && <Feedback error message={ error } /> }
		</div>
	);
}
function advanced( draft, errors ) {
	return (
		<Fragment>
			<CheckField
				label={ __(
					'Use a container loaded by another plugin',
					'pixelpair'
				) }
				checked={ draft.values.gtm_data_layer_only }
				onChange={ ( value ) =>
					draft.change( 'gtm_data_layer_only', value )
				}
				help={ __(
					'Only send data layer events; PixelPair will not load another container.',
					'pixelpair'
				) }
			/>
			<TextField
				label={ __( 'Custom container domain', 'pixelpair' ) }
				type="url"
				value={ draft.values.gtm_server_url }
				onChange={ ( value ) =>
					draft.change( 'gtm_server_url', value )
				}
				error={ errors.gtm_server_url }
				help={ __(
					'Optional HTTPS base address; PixelPair adds /gtm.js when loading your container.',
					'pixelpair'
				) }
			/>
			<TextField
				label={ __( 'Data layer name', 'pixelpair' ) }
				value={ draft.values.gtm_data_layer }
				onChange={ ( value ) =>
					draft.change( 'gtm_data_layer', value )
				}
				error={ errors.gtm_data_layer }
				help={ __(
					'Match the name used by your container and existing site tags.',
					'pixelpair'
				) }
			/>
			<TemplateDownload />
		</Fragment>
	);
}
export default function TagManager( props ) {
	return (
		<BrowserConnection
			platform="gtm"
			keys={ keys }
			validate={ validate }
			advanced={ advanced }
			basic={ () => (
				<p className="pixelpair-help">
					{ __(
						'Requires marketing and statistics consent. Avoid duplicating your Google Analytics events.',
						'pixelpair'
					) }
				</p>
			) }
			{ ...props }
		/>
	);
}
