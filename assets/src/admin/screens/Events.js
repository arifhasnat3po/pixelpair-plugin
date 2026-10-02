/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, lazy, Suspense } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	ToggleRow,
	SaveBar,
	Feedback,
	Skeleton,
} from '../components/ui';
import { TextField, CheckField } from '../components/ui/fields';
import EventTabs from '../components/EventTabs';
import EventMapping from '../components/EventMapping';
import { useDraft } from '../data/useDraft';
import { providers } from '../data/connections';
import {
	eventLabels,
	eventDescriptions,
	contextLabels,
	validMappings,
	validThresholds,
	listValues,
} from '../data/events';
const CustomEvents = lazy( () => import( './CustomEvents' ) );
const groups = [
	[
		__( 'Pages and search', 'pixelpair' ),
		[ 'page_view', 'search', 'not_found' ],
	],
	[
		__( 'Forms and accounts', 'pixelpair' ),
		[ 'form_submit', 'sign_up', 'login', 'comment' ],
	],
	[
		__( 'Engagement', 'pixelpair' ),
		[ 'file_download', 'scroll_depth', 'time_on_page', 'outbound_link' ],
	],
];
const optionKeys = {
	scroll_depth: 'scroll_thresholds',
	time_on_page: 'time_thresholds',
	file_download: 'download_extensions',
};
function AutomaticDetail( { event, settings, save, navigate, error } ) {
	const definition = settings.automatic_events[ event ];
	const option = optionKeys[ event ];
	const source = {
		platforms: definition.platforms,
		...( option ? { [ option ]: settings[ option ].join( ', ' ) } : {} ),
	};
	const write = ( patch ) =>
		save( ( latest ) => ( {
			...( patch.platforms
				? {
						automatic_events: {
							...latest.automatic_events,
							[ event ]: {
								...latest.automatic_events[ event ],
								platforms: patch.platforms,
							},
						},
					}
				: {} ),
			...( option && Object.hasOwn( patch, option )
				? {
						[ option ]:
							option === 'download_extensions'
								? listValues( patch[ option ] )
								: listValues( patch[ option ] ).map( Number ),
					}
				: {} ),
		} ) );
	const draft = useDraft( source, Object.keys( source ), write );
	const options = {
		scroll_thresholds: {
			label: __( 'Scroll percentages', 'pixelpair' ),
			help: __(
				'Separate percentages with commas; each creates an event once reached.',
				'pixelpair'
			),
			error: __(
				'Enter up to 20 whole percentages between 1 and 100.',
				'pixelpair'
			),
			valid: ( v ) => validThresholds( v, 100 ),
		},
		time_thresholds: {
			label: __( 'Visible time in seconds', 'pixelpair' ),
			help: __(
				'Separate seconds with commas; time counts only while the page is visible.',
				'pixelpair'
			),
			error: __(
				'Enter up to 20 whole seconds between 1 and 3600.',
				'pixelpair'
			),
			valid: ( v ) => validThresholds( v, 3600 ),
		},
		download_extensions: {
			label: __( 'File extensions', 'pixelpair' ),
			help: __(
				'Separate extensions with commas, without dots, such as pdf, zip.',
				'pixelpair'
			),
			error: __(
				'Use up to 50 lowercase extensions, each 1–10 letters or numbers.',
				'pixelpair'
			),
			valid: ( v ) =>
				listValues( v ).length <= 50 &&
				listValues( v ).every( ( extension ) =>
					/^[a-z0-9]{1,10}$/.test( extension )
				),
		},
	};
	const field = options[ option ];
	const invalid = field && ! field.valid( draft.values[ option ] );
	return (
		<Page
			title={ eventLabels[ event ] }
			description={ eventDescriptions[ event ] }
			back={
				<Button
					variant="tertiary"
					onClick={ () => navigate( 'events' ) }
				>
					{ __( 'Back to Events', 'pixelpair' ) }
				</Button>
			}
		>
			{ error && <Feedback error message={ error } /> }
			{ draft.message && <Feedback message={ draft.message } /> }
			<form
				onSubmit={ ( e ) => {
					e.preventDefault();
					if (
						! invalid &&
						validMappings( draft.values.platforms )
					) {
						draft.submit();
					}
				} }
			>
				<fieldset
					disabled={ draft.busy }
					className="pixelpair-fieldset"
				>
					{ field && (
						<Section title={ __( 'When to send', 'pixelpair' ) }>
							<TextField
								label={ field.label }
								help={ field.help }
								error={ invalid ? field.error : '' }
								value={ draft.values[ option ] }
								onChange={ ( value ) =>
									draft.change( option, value )
								}
							/>
						</Section>
					) }
					<Section
						title={ __( 'Where to send', 'pixelpair' ) }
						description={ __(
							'Choose a connection to edit its event name and parameters.',
							'pixelpair'
						) }
					>
						<EventMapping
							settings={ settings }
							value={ draft.values.platforms }
							onChange={ ( value ) =>
								draft.change( 'platforms', value )
							}
							pageView={ event === 'page_view' }
						/>
					</Section>
				</fieldset>
				<SaveBar
					dirty={ draft.dirty }
					busy={ draft.busy }
					disabled={
						invalid || ! validMappings( draft.values.platforms )
					}
					onDiscard={ draft.discard }
				/>
			</form>
		</Page>
	);
}
function EventData( { settings, save, error, navigate } ) {
	const draft = useDraft(
		settings,
		[ 'context_parameters', 'capture_form_fields' ],
		save
	);
	return (
		<Page
			title={ __( 'Event data', 'pixelpair' ) }
			description={ __(
				'Choose the extra context sent with events.',
				'pixelpair'
			) }
			back={
				<Button
					variant="tertiary"
					onClick={ () => navigate( 'events' ) }
				>
					{ __( 'Back to Events', 'pixelpair' ) }
				</Button>
			}
		>
			{ error && <Feedback error message={ error } /> }
			{ draft.message && <Feedback message={ draft.message } /> }
			<form
				onSubmit={ ( e ) => {
					e.preventDefault();
					draft.submit();
				} }
			>
				<fieldset
					className="pixelpair-fieldset"
					disabled={ draft.busy }
				>
					<Section
						title={ __( 'Page and campaign context', 'pixelpair' ) }
						description={ __(
							'These fields help explain where an event happened.',
							'pixelpair'
						) }
					>
						<div className="pixelpair-check-list">
							{ Object.entries( contextLabels ).map(
								( [ key, label ] ) => (
									<CheckField
										key={ key }
										label={ label }
										checked={ draft.values.context_parameters.includes(
											key
										) }
										onChange={ ( enabled ) =>
											draft.change(
												'context_parameters',
												enabled
													? [
															...draft.values
																.context_parameters,
															key,
														]
													: draft.values.context_parameters.filter(
															( item ) =>
																item !== key
														)
											)
										}
									/>
								)
							) }
						</div>
					</Section>
					<Section title={ __( 'Form matching', 'pixelpair' ) }>
						<CheckField
							label={ __(
								'Capture consented form email and phone',
								'pixelpair'
							) }
							help={ __(
								'Sends hashes only; requires marketing consent, Meta server events and advanced matching.',
								'pixelpair'
							) }
							checked={ draft.values.capture_form_fields }
							onChange={ ( value ) =>
								draft.change( 'capture_form_fields', value )
							}
						/>
					</Section>
				</fieldset>
				<SaveBar
					dirty={ draft.dirty }
					busy={ draft.busy }
					onDiscard={ draft.discard }
				/>
			</form>
		</Page>
	);
}
export default function Events( props ) {
	const { settings, save, navigate, route } = props;
	const event = route.split( '/' )[ 2 ];
	if ( route === 'events/data' ) {
		return <EventData { ...props } />;
	}
	if (
		route.startsWith( 'events/automatic/' ) &&
		settings.automatic_events[ event ]
	) {
		return <AutomaticDetail { ...props } key={ event } event={ event } />;
	}
	if ( route.startsWith( 'events/custom' ) ) {
		return (
			<Suspense fallback={ <Skeleton /> }>
				<CustomEvents { ...props } />
			</Suspense>
		);
	}
	return (
		<Page
			title={ __( 'Events', 'pixelpair' ) }
			description={ __(
				'Choose which events your enabled connections send.',
				'pixelpair'
			) }
		>
			<EventTabs current="events" navigate={ navigate } />
			{ groups.map( ( [ title, keys ] ) => (
				<Section
					key={ title }
					title={ title }
					className="pixelpair-event-group"
				>
					{ keys
						.filter( ( key ) => settings.automatic_events[ key ] )
						.map( ( key ) => {
							const definition = settings.automatic_events[ key ];
							return (
								<ToggleRow
									key={ key }
									label={ eventLabels[ key ] }
									description={ eventDescriptions[ key ] }
									checked={ definition.enabled }
									disabled={ key === 'page_view' }
									platforms={ Object.entries(
										definition.platforms
									)
										.filter( ( [ , p ] ) => p.enabled )
										.map(
											( [ id ] ) => providers[ id ].name
										) }
									onChange={ ( enabled ) =>
										save( ( latest ) => ( {
											automatic_events: {
												...latest.automatic_events,
												[ key ]: {
													...latest.automatic_events[
														key
													],
													enabled,
												},
											},
										} ) )
									}
									detail={
										<Button
											variant="tertiary"
											aria-label={ sprintf(
												/* translators: %1$s: event name. */ __(
													'Edit %1$s',
													'pixelpair'
												),
												eventLabels[ key ]
											) }
											onClick={ () =>
												navigate(
													`events/automatic/${ key }`
												)
											}
										>
											{ __( 'Edit', 'pixelpair' ) }
										</Button>
									}
								/>
							);
						} ) }
				</Section>
			) ) }
			<Section advanced>
				<p>
					{ __(
						'Choose which page, campaign and form details accompany events.',
						'pixelpair'
					) }
				</p>
				<div>
					<Button onClick={ () => navigate( 'events/data' ) }>
						{ __( 'Configure event data', 'pixelpair' ) }
					</Button>
				</div>
			</Section>
		</Page>
	);
}
