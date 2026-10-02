/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Feedback, ExternalLink, useUnsavedChanges } from './ui';
import { TextField } from './ui/fields';
import { providers } from '../data/connections';
import { links } from '../links';
import TestModeNotice from './TestModeNotice';

export default function ConnectionCheck( {
	platform,
	settings,
	credentials = {},
	disabled = false,
	onChecked = () => {},
} ) {
	const [ busy, setBusy ] = useState( false );
	const [ code, setCode ] = useState( credentials.test_code || '' );
	const [ result, setResult ] = useState( null );
	const [ message, setMessage ] = useState( '' );
	const [ error, setError ] = useState( false );
	const [ savedTest, setSavedTest ] = useState( null );
	useEffect( () => {
		setSavedTest( null );
	}, [ credentials.test_active, credentials.test_code ] );
	useEffect( () => {
		if ( ! busy ) {
			setCode( savedTest?.test_code ?? credentials.test_code ?? '' );
		}
	}, [ credentials.test_code, savedTest, busy ] );
	const server =
		providers[ platform ].server &&
		settings[ `${ platform }_capi_enabled` ];
	useUnsavedChanges( false, busy );
	const check = async () => {
		if ( busy || disabled ) {
			return;
		}
		setMessage( '' );
		setResult( null );
		setError( false );
		if ( server && ! code.trim() ) {
			setError( true );
			setMessage(
				__(
					'Add a test event code from Events Manager, then check again.',
					'pixelpair'
				)
			);
			return;
		}
		if ( server && ! credentials.token_set ) {
			setError( true );
			setMessage(
				__(
					'Save an access token before checking server delivery.',
					'pixelpair'
				)
			);
			return;
		}
		setBusy( true );
		let enabledTest = false;
		try {
			if ( server ) {
				if ( code !== credentials.test_code ) {
					await apiFetch( {
						path: `/pixelpair/v1/${ platform }`,
						method: 'POST',
						data: { test_code: code.trim() },
					} );
					enabledTest = true;
					setSavedTest( {
						test_code: code.trim(),
						test_active: true,
					} );
					await onChecked();
				}
				const response = await apiFetch( {
					path: `/pixelpair/v1/${ platform }/test`,
					method: 'POST',
				} );
				setResult( response );
				setError( ! response.success );
				if ( response.success ) {
					setMessage(
						sprintf(
							/* translators: %1$s: connection name. */ __(
								'%1$s accepted the test event.',
								'pixelpair'
							),
							providers[ platform ].name
						)
					);
				} else if (
					[ 401, 403 ].includes( response.code ) ||
					( platform === 'meta' &&
						response.response?.error_code === 190 )
				) {
					setMessage(
						sprintf(
							/* translators: %1$s: connection name. */ __(
								'%1$s rejected the access token. Create a new token in Events Manager and replace it here.',
								'pixelpair'
							),
							providers[ platform ].name
						)
					);
				} else if ( response.code === 0 ) {
					setMessage(
						__(
							'The server could not send this event. Check the saved ID, token and server connection, then try again.',
							'pixelpair'
						)
					);
				} else {
					setMessage(
						sprintf(
							/* translators: %1$s: platform, %2$d: HTTP response code. */ __(
								'%1$s did not accept the test event (HTTP %2$d). Review the response and your saved connection, then try again.',
								'pixelpair'
							),
							providers[ platform ].name,
							response.code
						)
					);
				}
				await onChecked();
			} else {
				const status = await apiFetch( {
					path: '/pixelpair/v1/dashboard',
				} );
				const configured = status.platforms?.[ platform ];
				if (
					! configured?.enabled ||
					( ! configured.id_set &&
						! (
							platform === 'gtm' && settings.gtm_data_layer_only
						) )
				) {
					throw new Error(
						__(
							'Save your ID and turn on tracking before checking this connection.',
							'pixelpair'
						)
					);
				}
				setMessage(
					platform === 'gtm' && settings.gtm_data_layer_only
						? __(
								'Data layer events are configured. Verify them in your existing Tag Manager container.',
								'pixelpair'
							)
						: __(
								'Browser tracking is configured. Open your site to verify that events reach the platform.',
								'pixelpair'
							)
				);
			}
		} catch ( problem ) {
			setError( true );
			setMessage(
				enabledTest
					? sprintf(
							/* translators: %1$s: connection error. */ __(
								'Test mode is on, but the check failed. %1$s',
								'pixelpair'
							),
							problem.message || __( 'Try again.', 'pixelpair' )
						)
					: problem.message ||
							__(
								'The check could not finish. Try again.',
								'pixelpair'
							)
			);
		} finally {
			setBusy( false );
		}
	};
	return (
		<div className="pixelpair-check-connection">
			{ server &&
				( savedTest?.test_active || credentials.test_active ) && (
					<TestModeNotice
						platform={ platform }
						onChange={ async () => {
							setSavedTest( null );
							await onChecked();
						} }
					/>
				) }
			{ server && (
				<TextField
					label={ __( 'Test event code', 'pixelpair' ) }
					value={ code }
					onChange={ setCode }
					disabled={ busy || disabled }
					help={
						<span>
							{ __(
								'Find this under Test events; checking turns on temporary test mode.',
								'pixelpair'
							) }{ ' ' }
							<ExternalLink
								href={ links[ `${ platform }Token` ] }
							/>
						</span>
					}
				/>
			) }
			<Button
				busy={ busy }
				busyLabel={ __( 'Checking…', 'pixelpair' ) }
				disabled={ disabled }
				onClick={ check }
			>
				{ __( 'Check connection', 'pixelpair' ) }
			</Button>
			{ message && (
				<Feedback
					error={ error }
					status={ server ? 'success' : 'info' }
					message={ message }
				/>
			) }
			{ result && (
				<details className="pixelpair-response">
					<summary>{ __( 'Show response', 'pixelpair' ) }</summary>
					<pre>{ JSON.stringify( result, null, 2 ) }</pre>
				</details>
			) }
		</div>
	);
}
