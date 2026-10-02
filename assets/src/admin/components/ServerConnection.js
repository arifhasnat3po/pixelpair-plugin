/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	Feedback,
	SaveBar,
	StatusBadge,
	Skeleton,
	ConfirmDialog,
	ExternalLink,
} from './ui';
import { IdField, SecretField, CheckField, validId } from './ui/fields';
import ConnectionCheck from './ConnectionCheck';
import { useDraft } from '../data/useDraft';
import { useResource } from '../data/useResource';
import { providers, connectionStatus } from '../data/connections';

export default function ServerConnection( {
	platform,
	advanced,
	settings,
	save,
	error,
	navigate,
} ) {
	const idKey = `${ platform }_pixel_id`;
	const enabledKey = `${ platform }_enabled`;
	const serverKey = `${ platform }_capi_enabled`;
	const draft = useDraft(
		settings,
		[
			idKey,
			enabledKey,
			serverKey,
			...advanced.map( ( item ) => item.key ),
		],
		save
	);
	const credentials = useResource( `/pixelpair/v1/${ platform }` );
	const dashboard = useResource( '/pixelpair/v1/dashboard' );
	const [ token, setToken ] = useState( '' );
	const [ revision, setRevision ] = useState( 0 );
	const [ busy, setBusy ] = useState( false );
	const [ problem, setProblem ] = useState( '' );
	const [ message, setMessage ] = useState( '' );
	const [ confirm, setConfirm ] = useState( false );
	const dirty = draft.dirty || !! token;
	const valid = validId(
		platform,
		draft.values[ idKey ],
		draft.values[ enabledKey ]
	);
	const needsToken =
		draft.values[ serverKey ] && ! credentials.data?.token_set && ! token;
	const change = ( key, value ) => {
		draft.change( key, value );
		setMessage( '' );
		setProblem( '' );
	};
	const submit = async ( event ) => {
		event?.preventDefault();
		if ( busy || ! valid || needsToken ) {
			return;
		}
		setBusy( true );
		setProblem( '' );
		setMessage( '' );
		let settingsSaved = false;
		try {
			if ( draft.dirty ) {
				if ( ! ( await draft.submit() ) ) {
					return;
				}
				settingsSaved = true;
			}
			if ( token ) {
				const result = await apiFetch( {
					path: `/pixelpair/v1/${ platform }`,
					method: 'POST',
					data: { token },
				} );
				credentials.setData( result );
				setToken( '' );
				setRevision( ( old ) => old + 1 );
			}
			setMessage( __( 'Changes saved', 'pixelpair' ) );
			await dashboard.refresh();
		} catch {
			setProblem(
				settingsSaved
					? __(
							'Connection settings saved, but the token could not be saved. Check it and save again.',
							'pixelpair'
						)
					: __(
							'The token could not be saved. Check it and save again.',
							'pixelpair'
						)
			);
		} finally {
			setBusy( false );
		}
	};
	const discard = () => {
		draft.discard();
		setToken( '' );
		setRevision( ( old ) => old + 1 );
		setMessage( '' );
		setProblem( '' );
	};
	const removeToken = async () => {
		setBusy( true );
		setProblem( '' );
		setMessage( '' );
		try {
			const result = await apiFetch( {
				path: `/pixelpair/v1/${ platform }`,
				method: 'POST',
				data: { remove_token: true },
			} );
			credentials.setData( result );
			setRevision( ( old ) => old + 1 );
			setConfirm( false );
			setMessage( __( 'Token removed', 'pixelpair' ) );
			await dashboard.refresh();
		} catch {
			setProblem(
				__( 'The token could not be removed. Try again.', 'pixelpair' )
			);
			setConfirm( false );
		} finally {
			setBusy( false );
		}
	};
	const status = connectionStatus( dashboard.data?.platforms?.[ platform ] );
	return (
		<Page
			title={ providers[ platform ].name }
			back={
				<Button
					variant="tertiary"
					onClick={ () => navigate( 'connections' ) }
				>
					{ __( 'Back to Connections', 'pixelpair' ) }
				</Button>
			}
			status={
				dashboard.data && (
					<StatusBadge status={ status.status }>
						{ status.text }
					</StatusBadge>
				)
			}
		>
			{ ( problem || error ) && (
				<Feedback error message={ problem || error } />
			) }
			{ message && <Feedback message={ message } /> }
			{ dashboard.error && (
				<Feedback
					error
					message={ dashboard.error }
					action={
						<Button onClick={ dashboard.refresh }>
							{ __( 'Retry status', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			<form onSubmit={ submit }>
				<fieldset disabled={ busy }>
					<Section
						title={ __( 'Tracking', 'pixelpair' ) }
						description={ __(
							'Connect your pixel to measure visits and events.',
							'pixelpair'
						) }
					>
						<CheckField
							label={ __(
								'Track visits and events',
								'pixelpair'
							) }
							help={ __(
								'Send events for visitors allowed by your Privacy settings.',
								'pixelpair'
							) }
							checked={ draft.values[ enabledKey ] }
							onChange={ ( value ) =>
								change( enabledKey, value )
							}
						/>
						<IdField
							platform={ platform }
							value={ draft.values[ idKey ] }
							onChange={ ( value ) => change( idKey, value ) }
							required={ draft.values[ enabledKey ] }
						/>
						<CheckField
							label={ __(
								'Send events from your server too',
								'pixelpair'
							) }
							help={ __(
								'Catches events that ad blockers hide from the browser pixel.',
								'pixelpair'
							) }
							checked={ draft.values[ serverKey ] }
							onChange={ ( value ) => change( serverKey, value ) }
						/>
						{ credentials.loading &&
							! credentials.data &&
							draft.values[ serverKey ] && <Skeleton /> }
						{ credentials.error && (
							<Feedback
								error
								message={ credentials.error }
								action={
									<Button onClick={ credentials.refresh }>
										{ __(
											'Retry credentials',
											'pixelpair'
										) }
									</Button>
								}
							/>
						) }
						{ draft.values[ serverKey ] && credentials.data && (
							<SecretField
								key={ `${ revision }-${ credentials.data.token_set }` }
								platform={ platform }
								configured={ credentials.data.token_set }
								value={ token }
								onChange={ ( value ) => {
									setToken( value );
									setMessage( '' );
								} }
							/>
						) }
					</Section>
					<Section
						title={ __( 'Check it works', 'pixelpair' ) }
						description={
							dirty
								? __(
										'Save your changes before checking this connection.',
										'pixelpair'
									)
								: __(
										'Check the saved connection, then verify events on your site.',
										'pixelpair'
									)
						}
					>
						{ credentials.data && (
							<ConnectionCheck
								key={ revision }
								platform={ platform }
								settings={ settings }
								credentials={ credentials.data }
								disabled={
									dirty || busy || ! settings[ enabledKey ]
								}
								onChecked={ async () => {
									await credentials.refresh();
									await dashboard.refresh();
								} }
							/>
						) }
						<ExternalLink
							href={ window.pixelpairAdmin?.siteUrl || '/' }
						>
							{ __( 'Open my site', 'pixelpair' ) }
						</ExternalLink>
					</Section>
					<Section advanced>
						{ advanced.map( ( item ) => (
							<CheckField
								key={ item.key }
								label={ item.label }
								help={ item.help }
								checked={ draft.values[ item.key ] }
								onChange={ ( value ) =>
									change( item.key, value )
								}
							/>
						) ) }
						{ credentials.data?.token_set && (
							<Button
								variant="destructive"
								disabled={ dirty }
								onClick={ () => setConfirm( true ) }
							>
								{ __( 'Remove token', 'pixelpair' ) }
							</Button>
						) }
					</Section>
				</fieldset>
				<SaveBar
					dirty={ dirty }
					busy={ busy }
					onDiscard={ discard }
					disabled={
						! valid ||
						needsToken ||
						credentials.loading ||
						!! credentials.error
					}
				/>
			</form>
			{ confirm && (
				<ConfirmDialog
					title={ sprintf(
						/* translators: %1$s: platform. */ __(
							'Remove the %1$s access token?',
							'pixelpair'
						),
						providers[ platform ].name
					) }
					confirmLabel={ __( 'Remove token', 'pixelpair' ) }
					onCancel={ () => setConfirm( false ) }
					onConfirm={ removeToken }
					busy={ busy }
				>
					{ __(
						'Server delivery stops until another token is saved. Your pixel ID stays saved.',
						'pixelpair'
					) }
				</ConfirmDialog>
			) }
		</Page>
	);
}
