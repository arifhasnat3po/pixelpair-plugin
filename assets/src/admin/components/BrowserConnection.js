/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	Feedback,
	SaveBar,
	StatusBadge,
	ExternalLink,
} from './ui';
import { IdField, CheckField, validId } from './ui/fields';
import ConnectionCheck from './ConnectionCheck';
import { useDraft } from '../data/useDraft';
import { useResource } from '../data/useResource';
import {
	providers,
	connectionStatus,
	configuredPlatforms,
} from '../data/connections';

export default function BrowserConnection( {
	platform,
	keys,
	advanced,
	basic,
	validate,
	settings,
	save,
	error,
	navigate,
} ) {
	const enabledKey = `${ platform }_enabled`;
	const idKey = providers[ platform ].field;
	const draft = useDraft( settings, [ enabledKey, idKey, ...keys ], save );
	const dashboard = useResource( '/pixelpair/v1/dashboard' );
	const id =
		platform === 'ga4'
			? ( draft.values[ idKey ] || [] ).join( ', ' )
			: draft.values[ idKey ];
	const required =
		draft.values[ enabledKey ] &&
		! ( platform === 'gtm' && draft.values.gtm_data_layer_only );
	const errors = validate( draft.values );
	const valid =
		validId( platform, id, required ) &&
		! Object.values( errors ).some( Boolean );
	const status = connectionStatus(
		configuredPlatforms( dashboard.data?.platforms, settings )?.[ platform ]
	);
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
			{ error && <Feedback error message={ error } /> }
			{ draft.message && <Feedback message={ draft.message } /> }
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
			<form
				onSubmit={ async ( event ) => {
					event.preventDefault();
					if ( valid && ( await draft.submit() ) ) {
						await dashboard.refresh();
					}
				} }
			>
				<fieldset disabled={ draft.busy }>
					<Section
						title={ __( 'Tracking', 'pixelpair' ) }
						description={ __(
							'Connect your account to measure visits and events.',
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
								draft.change( enabledKey, value )
							}
						/>
						<IdField
							platform={ platform }
							value={ id }
							required={ required }
							onChange={ ( value ) =>
								draft.change(
									idKey,
									platform === 'ga4'
										? value
												.split( /[,\s]+/ )
												.filter( Boolean )
										: value
								)
							}
						/>
						{ basic?.( draft ) }
					</Section>
					<Section
						title={ __( 'Check it works', 'pixelpair' ) }
						description={
							draft.dirty
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
						<ConnectionCheck
							platform={ platform }
							settings={ settings }
							disabled={
								draft.dirty ||
								draft.busy ||
								! settings[ enabledKey ]
							}
						/>
						<ExternalLink
							href={ window.pixelpairAdmin?.siteUrl || '/' }
						>
							{ __( 'Open my site', 'pixelpair' ) }
						</ExternalLink>
					</Section>
					<Section advanced>{ advanced( draft, errors ) }</Section>
				</fieldset>
				<SaveBar
					dirty={ draft.dirty }
					busy={ draft.busy }
					onDiscard={ draft.discard }
					disabled={ ! valid }
				/>
			</form>
		</Page>
	);
}
