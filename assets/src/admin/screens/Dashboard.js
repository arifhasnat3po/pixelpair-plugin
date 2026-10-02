/** @jsxRuntime classic */
/** @jsx createElement */
import {
	createElement,
	Fragment,
	useState,
	useEffect,
} from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	Feedback,
	ExternalLink,
	Skeleton,
	useUnsavedChanges,
} from '../components/ui';
import {
	IdField,
	SecretField,
	CheckField,
	validId,
} from '../components/ui/fields';
import Brand from '../components/Brand';
import ConnectionCheck from '../components/ConnectionCheck';
import { providers } from '../data/connections';
import { useResource } from '../data/useResource';

const labels = {
	meta: __( 'Facebook and Instagram ads (Meta)', 'pixelpair' ),
	ga4: __( 'Google Analytics', 'pixelpair' ),
	gtm: __( 'Google Tag Manager', 'pixelpair' ),
	tiktok: __( 'TikTok ads', 'pixelpair' ),
};
const idLabels = {
	meta: __( 'Meta Pixel ID', 'pixelpair' ),
	ga4: __( 'Measurement IDs', 'pixelpair' ),
	gtm: __( 'Container ID', 'pixelpair' ),
	tiktok: __( 'TikTok Pixel ID', 'pixelpair' ),
};
const titles = [
	__( 'What do you want to track?', 'pixelpair' ),
	__( 'Connect', 'pixelpair' ),
	__( 'Check it works', 'pixelpair' ),
	__( 'Skip yourself', 'pixelpair' ),
];

export default function Dashboard( { settings, save, error, navigate } ) {
	const [ step, setStep ] = useState( 0 );
	const [ values, setValues ] = useState( () =>
		Object.fromEntries(
			Object.entries( providers ).flatMap( ( [ id, p ] ) => [
				[ `${ id }_enabled`, !! settings[ `${ id }_enabled` ] ],
				[ p.field, settings[ p.field ] || ( id === 'ga4' ? [] : '' ) ],
				...( p.server
					? [
							[
								`${ id }_capi_enabled`,
								!! settings[ `${ id }_capi_enabled` ],
							],
						]
					: [] ),
			] )
		)
	);
	const [ tokens, setTokens ] = useState( { meta: '', tiktok: '' } );
	const [ exclude, setExclude ] = useState( true );
	const [ busy, setBusy ] = useState( false );
	const [ problem, setProblem ] = useState( '' );
	const [ done, setDone ] = useState( false );
	const meta = useResource( '/pixelpair/v1/meta' );
	const tiktok = useResource( '/pixelpair/v1/tiktok' );
	const credentials = { meta, tiktok };
	const selected = Object.keys( providers ).filter(
		( id ) => values[ `${ id }_enabled` ]
	);
	const patch = {};
	for ( const [ id, provider ] of Object.entries( providers ) ) {
		const enabled = `${ id }_enabled`;
		if ( values[ enabled ] !== !! settings[ enabled ] ) {
			patch[ enabled ] = values[ enabled ];
		}
		if ( ! values[ enabled ] ) {
			continue;
		}
		for ( const key of [
			provider.field,
			...( provider.server ? [ `${ id }_capi_enabled` ] : [] ),
		] ) {
			if (
				JSON.stringify( values[ key ] ) !==
				JSON.stringify( settings[ key ] )
			) {
				patch[ key ] = values[ key ];
			}
		}
	}
	useUnsavedChanges(
		! done &&
			( Object.keys( patch ).length > 0 ||
				Object.values( tokens ).some( Boolean ) ),
		busy
	);
	useEffect( () => {
		if ( done ) {
			navigate( 'overview' );
		}
	}, [ done, navigate ] );
	const change = ( key, value ) => {
		setValues( ( old ) => ( { ...old, [ key ]: value } ) );
		setProblem( '' );
	};
	const ready =
		selected.length > 0 &&
		selected.every(
			( id ) =>
				validId(
					id,
					id === 'ga4'
						? values.ga4_ids.join( ', ' )
						: values[ providers[ id ].field ],
					true
				) &&
				( ! providers[ id ].server ||
					! values[ `${ id }_capi_enabled` ] ||
					( !! credentials[ id ].data &&
						( credentials[ id ].data.token_set ||
							tokens[ id ].length >= 10 ) ) )
		);
	const connect = async () => {
		if ( busy || ! ready ) {
			return;
		}
		setBusy( true );
		setProblem( '' );
		try {
			if ( Object.keys( patch ).length && ! ( await save( patch ) ) ) {
				return;
			}
			for ( const id of selected.filter(
				( key ) =>
					providers[ key ].server &&
					values[ `${ key }_capi_enabled` ] &&
					tokens[ key ]
			) ) {
				try {
					const status = await apiFetch( {
						path: `/pixelpair/v1/${ id }`,
						method: 'POST',
						data: { token: tokens[ id ] },
					} );
					credentials[ id ].setData( status );
					setTokens( ( old ) => ( { ...old, [ id ]: '' } ) );
				} catch ( failure ) {
					throw new Error(
						sprintf(
							/* translators: %1$s: connection, %2$s: server error. */ __(
								'Connection settings saved. The %1$s token was not saved: %2$s',
								'pixelpair'
							),
							providers[ id ].name,
							failure.message
						)
					);
				}
			}
			setStep( 2 );
		} catch ( failure ) {
			setProblem( failure.message );
		} finally {
			setBusy( false );
		}
	};
	const finish = async ( skip ) => {
		if ( busy ) {
			return;
		}
		setBusy( true );
		setProblem( '' );
		const changes = { onboarding_complete: true };
		if ( ! skip ) {
			changes.excluded_roles = ( settings.excluded_roles || [] ).filter(
				( role ) => role !== 'administrator'
			);
			if ( exclude ) {
				changes.excluded_roles.push( 'administrator' );
			}
		}
		try {
			if ( await save( changes ) ) {
				setDone( true );
			}
		} catch ( failure ) {
			setProblem( failure.message );
		} finally {
			setBusy( false );
		}
	};
	return (
		<Page
			title={ titles[ step ] }
			description={ sprintf(
				/* translators: %1$d: current setup step, %2$d: total steps. */ __(
					'Step %1$d of %2$d',
					'pixelpair'
				),
				step + 1,
				4
			) }
			brand={ step === 0 ? <Brand /> : undefined }
			action={
				<Button
					variant="tertiary"
					disabled={ busy }
					onClick={ () => finish( true ) }
				>
					{ __( 'Skip setup', 'pixelpair' ) }
				</Button>
			}
		>
			{ ( error || problem ) && (
				<Feedback error message={ problem || error } />
			) }
			<fieldset disabled={ busy } className="pixelpair-wizard-fields">
				{ step === 0 && (
					<Section
						title={ __( 'Choose your connections', 'pixelpair' ) }
						description={ __(
							'You can add or change connections later.',
							'pixelpair'
						) }
					>
						{ Object.keys( providers ).map( ( id ) => (
							<CheckField
								key={ id }
								label={ labels[ id ] }
								checked={ values[ `${ id }_enabled` ] }
								onChange={ ( enabled ) =>
									change( `${ id }_enabled`, enabled )
								}
							/>
						) ) }
					</Section>
				) }
				{ step === 1 &&
					selected.map( ( id ) => (
						<Section
							key={ id }
							title={ providers[ id ].name }
							description={ __(
								'Paste an ID or the full setup code.',
								'pixelpair'
							) }
						>
							<IdField
								platform={ id }
								label={ idLabels[ id ] }
								required
								value={
									id === 'ga4'
										? values.ga4_ids.join( ', ' )
										: values[ providers[ id ].field ]
								}
								onChange={ ( value ) =>
									change(
										providers[ id ].field,
										id === 'ga4'
											? value
													.split( /[,\s]+/ )
													.filter( Boolean )
											: value
									)
								}
							/>
							{ providers[ id ].server && (
								<Fragment>
									<CheckField
										label={ __(
											'Send events from your server too',
											'pixelpair'
										) }
										help={ __(
											'Catches sales that ad blockers hide from the browser pixel.',
											'pixelpair'
										) }
										checked={
											values[ `${ id }_capi_enabled` ]
										}
										onChange={ ( enabled ) =>
											change(
												`${ id }_capi_enabled`,
												enabled
											)
										}
									/>
									{ values[ `${ id }_capi_enabled` ] && (
										<Fragment>
											{ credentials[ id ].loading &&
												! credentials[ id ].data && (
													<Skeleton />
												) }
											{ credentials[ id ].error && (
												<Feedback
													error
													message={
														credentials[ id ].error
													}
													action={
														<Button
															onClick={
																credentials[
																	id
																].refresh
															}
														>
															{ __(
																'Retry token status',
																'pixelpair'
															) }
														</Button>
													}
												/>
											) }
											{ credentials[ id ].data && (
												<SecretField
													key={ `${ id }-${ credentials[ id ].data.token_set }` }
													platform={ id }
													configured={
														credentials[ id ].data
															.token_set
													}
													value={ tokens[ id ] }
													onChange={ ( token ) =>
														setTokens(
															( old ) => ( {
																...old,
																[ id ]: token,
															} )
														)
													}
												/>
											) }
										</Fragment>
									) }
								</Fragment>
							) }
						</Section>
					) ) }
				{ step === 2 && (
					<Fragment>
						{ selected.map( ( id ) => (
							<Section key={ id } title={ providers[ id ].name }>
								<ConnectionCheck
									platform={ id }
									settings={ values }
									credentials={
										credentials[ id ]?.data || {}
									}
									onChecked={ credentials[ id ]?.refresh }
								/>
							</Section>
						) ) }
						<div className="pixelpair-page-end">
							<ExternalLink
								href={ window.pixelpairAdmin?.siteUrl }
							>
								{ __(
									'Open my site to see it live',
									'pixelpair'
								) }
							</ExternalLink>
							<p className="pixelpair-description">
								{ __(
									'Use Meta Pixel Helper on your site to confirm a PageView.',
									'pixelpair'
								) }
							</p>
						</div>
					</Fragment>
				) }
				{ step === 3 && (
					<Section
						title={ __(
							'Keep your visits out of reports',
							'pixelpair'
						) }
					>
						<CheckField
							label={ __(
								'Don’t track my visits while I’m logged in',
								'pixelpair'
							) }
							help={ __(
								'Excludes all administrators while logged in; other role exclusions stay unchanged.',
								'pixelpair'
							) }
							checked={ exclude }
							onChange={ setExclude }
						/>
					</Section>
				) }
			</fieldset>
			<div className="pixelpair-actions pixelpair-page-end">
				{ step > 0 && (
					<Button
						disabled={ busy }
						onClick={ () => setStep( step - 1 ) }
					>
						{ __( 'Back', 'pixelpair' ) }
					</Button>
				) }
				{ step === 0 && (
					<Button
						variant="primary"
						disabled={ ! selected.length }
						onClick={ () => setStep( 1 ) }
					>
						{ __( 'Continue', 'pixelpair' ) }
					</Button>
				) }
				{ step === 1 && (
					<Button
						variant="primary"
						busy={ busy }
						disabled={ ! ready }
						onClick={ connect }
					>
						{ __( 'Save and continue', 'pixelpair' ) }
					</Button>
				) }
				{ step === 2 && (
					<Button variant="primary" onClick={ () => setStep( 3 ) }>
						{ __( 'Continue', 'pixelpair' ) }
					</Button>
				) }
				{ step === 3 && (
					<Button
						variant="primary"
						busy={ busy }
						onClick={ () => finish( false ) }
					>
						{ __( 'Finish setup', 'pixelpair' ) }
					</Button>
				) }
			</div>
		</Page>
	);
}
