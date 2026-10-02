/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	Section,
	Button,
	Feedback,
	ConfirmDialog,
	Field,
	useUnsavedChanges,
} from './ui';
import { TextField } from './ui/fields';
import { downloadFile } from '../data/download';
export default function ConfigurationTransfer( { disabled, load, onBusy } ) {
	const [ json, setJson ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ message, setMessage ] = useState( '' );
	const [ busy, setBusy ] = useState( '' );
	const [ preview, setPreview ] = useState( null );
	const [ needsRefresh, setNeedsRefresh ] = useState( false );
	const markBusy = ( value, locked = needsRefresh ) => {
		setBusy( value );
		onBusy( !! value || locked );
	};
	useUnsavedChanges( !! json, !! busy || needsRefresh );
	const importedMessage = __(
		'Configuration imported. Purge your page cache.',
		'pixelpair'
	);
	const refreshMessage = __(
		'Imported, but settings could not refresh. Refresh settings before editing.',
		'pixelpair'
	);
	const refresh = async () => {
		markBusy( 'refresh' );
		const refreshed = ( await load() ) !== false;
		setNeedsRefresh( ! refreshed );
		setError( refreshed ? '' : refreshMessage );
		setMessage( refreshed ? importedMessage : '' );
		markBusy( '', ! refreshed );
	};
	const exportFile = async () => {
		markBusy( 'export' );
		setError( '' );
		try {
			const data = await apiFetch( { path: '/pixelpair/v1/transfer' } );
			downloadFile(
				'pixelpair-settings.json',
				JSON.stringify( data, null, 2 )
			);
			setMessage( __( 'Saved configuration exported', 'pixelpair' ) );
		} catch ( problem ) {
			setError(
				problem.message ||
					__( 'Export failed. Try again.', 'pixelpair' )
			);
		} finally {
			markBusy( '' );
		}
	};
	const review = () => {
		setError( '' );
		setMessage( '' );
		try {
			const data = JSON.parse( json );
			if (
				new TextEncoder().encode( json ).length > 524288 ||
				data?.format !== 'pixelpair' ||
				data.version !== 1 ||
				! Array.isArray( data.events ) ||
				data.events.length > 100 ||
				! data.settings ||
				typeof data.settings !== 'object' ||
				Array.isArray( data.settings )
			) {
				throw new Error();
			}
			setPreview( data );
		} catch {
			setError(
				__(
					'Choose a PixelPair version 1 export under 512 KB with at most 100 events.',
					'pixelpair'
				)
			);
		}
	};
	const apply = async () => {
		markBusy( 'import' );
		setError( '' );
		let refreshed = true;
		try {
			await apiFetch( {
				path: '/pixelpair/v1/transfer',
				method: 'POST',
				data: preview,
			} );
			setJson( '' );
			setPreview( null );
			refreshed = ( await load() ) !== false;
			setNeedsRefresh( ! refreshed );
			setMessage( refreshed ? importedMessage : '' );
			setError( refreshed ? '' : refreshMessage );
		} catch ( problem ) {
			setError(
				problem.message ||
					__(
						'Import failed. No confirmation was received; reload settings before retrying.',
						'pixelpair'
					)
			);
		} finally {
			markBusy( '', ! refreshed );
		}
	};
	return (
		<Section advanced title={ __( 'Import and export', 'pixelpair' ) }>
			<p className="pixelpair-helper">
				{ __(
					'Exports contain saved preferences and custom events. Tokens, scripts and permissions are always excluded.',
					'pixelpair'
				) }
			</p>
			{ error && ! preview && <Feedback error message={ error } /> }
			{ needsRefresh && (
				<Button
					onClick={ refresh }
					busy={ busy === 'refresh' }
					busyLabel={ __( 'Refreshing…', 'pixelpair' ) }
				>
					{ __( 'Refresh settings', 'pixelpair' ) }
				</Button>
			) }
			{ message && <Feedback message={ message } /> }
			<Button
				busy={ busy === 'export' }
				busyLabel={ __( 'Exporting…', 'pixelpair' ) }
				disabled={ !! busy || disabled || needsRefresh }
				onClick={ exportFile }
			>
				{ __( 'Download settings JSON', 'pixelpair' ) }
			</Button>
			<Field
				label={ __( 'Choose settings JSON', 'pixelpair' ) }
				help={ __(
					'Choose an exported file up to 512 KB; review it before replacing settings.',
					'pixelpair'
				) }
			>
				<input
					type="file"
					accept=".json,application/json"
					disabled={ !! busy || disabled || needsRefresh }
					onChange={ async ( event ) => {
						const file = event.target.files?.[ 0 ];
						setMessage( '' );
						setError( '' );
						setJson( '' );
						if ( ! file ) {
							return;
						}
						if ( file.size > 524288 ) {
							setError(
								__(
									'The import file must be smaller than 512 KB.',
									'pixelpair'
								)
							);
							return;
						}
						try {
							markBusy( 'read' );
							setJson( await file.text() );
						} catch {
							setError(
								__(
									'The file could not be read. Choose it again.',
									'pixelpair'
								)
							);
						} finally {
							markBusy( '' );
						}
					} }
				/>
			</Field>
			<TextField
				label={ __( 'Import JSON preview', 'pixelpair' ) }
				multiline
				rows={ 5 }
				value={ json }
				disabled={ !! busy || disabled || needsRefresh }
				onChange={ ( value ) => {
					setJson( value );
					setError( '' );
					setMessage( '' );
				} }
			/>
			{ disabled && (
				<p className="pixelpair-helper">
					{ __(
						'Save or discard your changes before importing or exporting.',
						'pixelpair'
					) }
				</p>
			) }
			<div className="pixelpair-actions">
				<Button
					disabled={
						!! busy || disabled || needsRefresh || ! json.trim()
					}
					onClick={ review }
				>
					{ __( 'Review import', 'pixelpair' ) }
				</Button>
				{ json && (
					<Button
						variant="tertiary"
						disabled={ !! busy }
						onClick={ () => {
							setJson( '' );
							setError( '' );
						} }
					>
						{ __( 'Clear import draft', 'pixelpair' ) }
					</Button>
				) }
			</div>
			{ preview && (
				<ConfirmDialog
					title={ __(
						'Replace settings and custom events?',
						'pixelpair'
					) }
					confirmLabel={ __( 'Confirm import', 'pixelpair' ) }
					busy={ !! busy }
					error={ error }
					onCancel={ () => setPreview( null ) }
					onConfirm={ apply }
				>
					{ sprintf(
						/* translators: %1$d: number of imported custom events. */ _n(
							'Replace all preferences and custom events with this file’s %1$d event. Tokens, scripts and permissions stay. Tracking may turn on.',
							'Replace all preferences and custom events with this file’s %1$d events. Tokens, scripts and permissions stay. Tracking may turn on.',
							preview.events.length,
							'pixelpair'
						),
						preview.events.length
					) }
				</ConfirmDialog>
			) }
		</Section>
	);
}
