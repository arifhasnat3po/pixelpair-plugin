/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, Fragment } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	ExternalLink,
	Feedback,
	Skeleton,
	EmptyState,
	MatchIndicator,
} from '../components/ui';
import Brand from '../components/Brand';
import { logMatchState } from '../data/logs';
import ConnectionList from '../components/ConnectionList';
import TestModeNotice from '../components/TestModeNotice';
import {
	providers,
	connectionStatus,
	configuredPlatforms,
} from '../data/connections';
import { useResource } from '../data/useResource';

export default function Overview( { settings, navigate } ) {
	const resource = useResource( '/pixelpair/v1/dashboard' );
	const activity = useResource( '/pixelpair/v1/logs?page=1' );
	const platforms = configuredPlatforms( resource.data?.platforms, settings );
	const broken =
		platforms &&
		Object.keys( providers ).find(
			( id ) => connectionStatus( platforms[ id ] ).status === 'error'
		);
	const count = platforms
		? Object.values( platforms ).filter(
				( p ) => p.enabled && ( p.id_set || p.data_layer_only )
			).length
		: 0;
	let summary = __(
		'No connections are tracking yet. Set up your first connection below.',
		'pixelpair'
	);
	if ( count ) {
		summary = sprintf(
			/* translators: %1$d: configured connection count. */ _n(
				'Tracking is configured for %1$d connection. Open your site to verify browser events.',
				'Tracking is configured for %1$d connections. Open your site to verify browser events.',
				count,
				'pixelpair'
			),
			count
		);
	}
	if ( broken ) {
		summary = sprintf(
			/* translators: %1$s: connection name. */ __(
				'%1$s needs attention. Open its settings to fix the connection.',
				'pixelpair'
			),
			providers[ broken ].name
		);
	}
	return (
		<Page
			title={ __( 'Overview', 'pixelpair' ) }
			brand={ <Brand /> }
			action={
				<ExternalLink href={ window.pixelpairAdmin?.siteUrl }>
					{ __( 'View site', 'pixelpair' ) }
				</ExternalLink>
			}
		>
			{ resource.error && (
				<Feedback
					error
					message={ resource.error }
					action={
						<Button onClick={ resource.refresh }>
							{ __( 'Retry', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			{ ! platforms && resource.loading && <Skeleton /> }
			{ platforms && (
				<Fragment>
					<p className="pixelpair-overall">{ summary }</p>
					{ Object.keys( providers )
						.filter( ( id ) => platforms[ id ]?.test_mode )
						.map( ( id ) => (
							<TestModeNotice
								key={ id }
								platform={ id }
								onChange={ resource.refresh }
							/>
						) ) }
					<Section title={ __( 'Connections', 'pixelpair' ) }>
						<ConnectionList
							platforms={ platforms }
							navigate={ navigate }
						/>
					</Section>
				</Fragment>
			) }
			<Section
				title={ __( 'Recent events', 'pixelpair' ) }
				description={ __(
					'Server deliveries recorded by PixelPair. Browser matching is not verified here.',
					'pixelpair'
				) }
			>
				{ activity.error && (
					<Feedback
						error
						message={ activity.error }
						action={
							<Button onClick={ activity.refresh }>
								{ __( 'Retry activity', 'pixelpair' ) }
							</Button>
						}
					/>
				) }
				{ activity.loading && ! activity.data && <Skeleton /> }
				{ activity.data?.items.length > 0 ? (
					<ul className="pixelpair-recent">
						{ activity.data.items.slice( 0, 5 ).map( ( row ) => (
							<li key={ row.id }>
								<strong>{ row.event_name }</strong>
								<span>
									{ providers[ row.platform ]?.name ||
										row.platform }
								</span>
								<MatchIndicator
									state={ logMatchState( row.status ) }
								/>
								<time>
									{ new Date(
										Number( row.created_at ) * 1000
									).toLocaleString() }
								</time>
							</li>
						) ) }
					</ul>
				) : (
					! activity.loading &&
					! activity.error && (
						<EmptyState
							action={
								<Button
									onClick={ () => navigate( 'settings' ) }
								>
									{ __( 'Manage logging', 'pixelpair' ) }
								</Button>
							}
						>
							{ settings.logging_enabled
								? __(
										'No server events recorded yet. Visit your site to generate an event.',
										'pixelpair'
									)
								: __(
										'Logging is off. Turn it on to inspect server deliveries.',
										'pixelpair'
									) }
						</EmptyState>
					)
				) }
				{ activity.data?.items.length > 0 && (
					<Button
						variant="tertiary"
						onClick={ () => navigate( 'activity' ) }
					>
						{ __( 'See all activity', 'pixelpair' ) }
					</Button>
				) }
			</Section>
			<div className="pixelpair-page-end">
				<Button
					variant="tertiary"
					onClick={ () => navigate( 'setup' ) }
				>
					{ __( 'Run setup again', 'pixelpair' ) }
				</Button>
			</div>
		</Page>
	);
}
