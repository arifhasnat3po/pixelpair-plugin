/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	SaveBar,
	Feedback,
	Skeleton,
	EmptyState,
	ConfirmDialog,
} from '../components/ui';
import { TextField, SelectField } from '../components/ui/fields';
import { useResource } from '../data/useResource';
import { useDraft } from '../data/useDraft';
const locations = {
	head: __( 'Head', 'pixelpair' ),
	body: __( 'After body opens', 'pixelpair' ),
	footer: __( 'Footer', 'pixelpair' ),
	receipt: __( 'Paid receipt', 'pixelpair' ),
};
function ScriptForm( { data, setData } ) {
	const [ location, setLocation ] = useState( 'head' );
	const [ error, setError ] = useState( '' );
	const [ confirm, setConfirm ] = useState( false );
	const write = async ( patch ) => {
		setError( '' );
		try {
			setData(
				await apiFetch( {
					path: '/pixelpair/v1/scripts',
					method: 'POST',
					data: { ...data, ...patch },
				} )
			);
			return true;
		} catch ( problem ) {
			setError(
				problem.message ||
					__(
						'Scripts could not be saved. Check your permission and try again.',
						'pixelpair'
					)
			);
			return false;
		}
	};
	const draft = useDraft( data, Object.keys( locations ), write );
	const value = draft.values[ location ];
	const change = ( key, next ) =>
		draft.change( location, { ...value, [ key ]: next } );
	const valid = Object.values( draft.values ).every(
		( slot ) => new TextEncoder().encode( slot.code ).length <= 32768
	);
	return (
		<form
			onSubmit={ ( event ) => {
				event.preventDefault();
				if ( valid ) {
					draft.submit();
				}
			} }
		>
			{ error && <Feedback error message={ error } /> }
			{ draft.message && <Feedback message={ draft.message } /> }
			<fieldset className="pixelpair-fieldset" disabled={ draft.busy }>
				<div
					className="pixelpair-subnav"
					role="group"
					aria-label={ __( 'Script locations', 'pixelpair' ) }
				>
					{ Object.entries( locations ).map( ( [ key, label ] ) => (
						<Button
							key={ key }
							variant="tertiary"
							aria-pressed={ location === key }
							onClick={ () => setLocation( key ) }
						>
							{ label }
						</Button>
					) ) }
				</div>
				<Section
					title={ locations[ location ] }
					description={
						location === 'receipt'
							? __(
									'Runs only on an authorized WooCommerce paid receipt.',
									'pixelpair'
								)
							: __(
									'Runs once at this location after the selected consent is granted.',
									'pixelpair'
								)
					}
				>
					<TextField
						label={ __( 'HTML and scripts', 'pixelpair' ) }
						multiline
						rows={ 10 }
						value={ value.code }
						onChange={ ( next ) => change( 'code', next ) }
						help={ __(
							'Paste trusted HTML and script tags, up to 32 KB per location.',
							'pixelpair'
						) }
						error={
							new TextEncoder().encode( value.code ).length >
							32768
								? __(
										'Keep this location under 32 KB.',
										'pixelpair'
									)
								: ''
						}
						spellCheck={ false }
					/>
					{ location === 'receipt' && (
						<p className="pixelpair-helper">
							{ __(
								'Use unquoted {order_id}, {order_total} and {currency} for safe JavaScript values.',
								'pixelpair'
							) }
						</p>
					) }
					<SelectField
						label={ __( 'Consent category', 'pixelpair' ) }
						help={ __(
							'Wait for this consent category before running the script.',
							'pixelpair'
						) }
						value={ value.consent }
						onChange={ ( next ) => change( 'consent', next ) }
						options={ [
							{
								value: 'marketing',
								label: __( 'Marketing', 'pixelpair' ),
							},
							{
								value: 'statistics',
								label: __( 'Statistics', 'pixelpair' ),
							},
						] }
					/>
					<SelectField
						label={ __( 'Devices', 'pixelpair' ) }
						help={ __(
							'Mobile means a viewport up to 767 px wide.',
							'pixelpair'
						) }
						value={ value.device }
						onChange={ ( next ) => change( 'device', next ) }
						options={ [
							{
								value: 'all',
								label: __( 'All devices', 'pixelpair' ),
							},
							{
								value: 'desktop',
								label: __( 'Desktop', 'pixelpair' ),
							},
							{
								value: 'mobile',
								label: __( 'Mobile', 'pixelpair' ),
							},
						] }
					/>
					{ value.code && (
						<Button
							variant="destructive"
							onClick={ () => setConfirm( true ) }
						>
							{ __( 'Clear this script', 'pixelpair' ) }
						</Button>
					) }
				</Section>
				<Section advanced>
					<p>
						{ __(
							'For per-page rules, open the page editor and use the PixelPair scripts panel.',
							'pixelpair'
						) }
					</p>
					<p>
						{ __(
							'Choose inherit, append, replace or disable there. Configure revocation in the script itself.',
							'pixelpair'
						) }
					</p>
				</Section>
			</fieldset>
			<SaveBar
				dirty={ draft.dirty }
				busy={ draft.busy }
				disabled={ ! valid }
				onDiscard={ () => {
					draft.discard();
					setError( '' );
				} }
			/>
			{ confirm && (
				<ConfirmDialog
					title={ sprintf(
						/* translators: %1$s: script location. */ __(
							'Clear the %1$s script?',
							'pixelpair'
						),
						locations[ location ]
					) }
					confirmLabel={ __( 'Clear script draft', 'pixelpair' ) }
					onCancel={ () => setConfirm( false ) }
					onConfirm={ () => {
						change( 'code', '' );
						setConfirm( false );
					} }
				>
					{ __(
						'This clears the draft for this location. Save changes to apply it.',
						'pixelpair'
					) }
				</ConfirmDialog>
			) }
		</form>
	);
}
function ScriptResource() {
	const resource = useResource( '/pixelpair/v1/scripts' );
	return (
		<Page
			title={ __( 'Scripts', 'pixelpair' ) }
			description={ __(
				'Add code to your site with consent and device controls.',
				'pixelpair'
			) }
		>
			{ resource.error && (
				<Feedback
					error
					message={ resource.error }
					action={
						<Button
							busy={ resource.loading }
							busyLabel={ __( 'Loading…', 'pixelpair' ) }
							onClick={ resource.refresh }
						>
							{ __( 'Retry', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			{ resource.loading && ! resource.data && <Skeleton /> }
			{ resource.data && (
				<ScriptForm
					data={ resource.data }
					setData={ resource.setData }
				/>
			) }
		</Page>
	);
}
export default function Scripts() {
	if ( ! window.pixelpairAdmin?.canScripts ) {
		return (
			<Page title={ __( 'Scripts', 'pixelpair' ) }>
				<EmptyState>
					{ __(
						'Ask a site administrator for permission to manage scripts.',
						'pixelpair'
					) }
				</EmptyState>
			</Page>
		);
	}
	return <ScriptResource />;
}
