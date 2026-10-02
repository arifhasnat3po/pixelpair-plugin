/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Button,
	Feedback,
	Skeleton,
	EmptyState,
	ConfirmDialog,
	MatchIndicator,
	StatusBadge,
} from '../components/ui';
import { SelectField } from '../components/ui/fields';
import { useResource } from '../data/useResource';
import { downloadFile } from '../data/download';
import { logStatuses, logMatchState, logDetails, logsCsv } from '../data/logs';
export default function Logs( {
	settings,
	save,
	error: settingsError,
	navigate,
} ) {
	const [ page, setPage ] = useState( 1 );
	const [ status, setStatus ] = useState( '' );
	const [ platform, setPlatform ] = useState( '' );
	const [ confirm, setConfirm ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ message, setMessage ] = useState( '' );
	const resource = useResource(
		`/pixelpair/v1/logs?page=${ page }&status=${ status }&platform=${ platform }`
	);
	const data = resource.data;
	const blocked = busy || resource.loading;
	const clear = async () => {
		setBusy( true );
		setError( '' );
		setMessage( '' );
		try {
			const result = await apiFetch( {
				path: '/pixelpair/v1/logs?page=1&confirm=yes',
				method: 'DELETE',
			} );
			resource.setData( result );
			setPage( 1 );
			setConfirm( false );
			setMessage( __( 'Logs cleared', 'pixelpair' ) );
		} catch ( problem ) {
			setError(
				problem.message ||
					__( 'Logs could not be cleared. Try again.', 'pixelpair' )
			);
		} finally {
			setBusy( false );
		}
	};
	const enable = async () => {
		setBusy( true );
		try {
			if ( await save( { logging_enabled: true } ) ) {
				setMessage( __( 'Logging turned on', 'pixelpair' ) );
			}
		} finally {
			setBusy( false );
		}
	};
	return (
		<Page
			title={ __( 'Activity', 'pixelpair' ) }
			description={ __(
				'Review server delivery. Browser receipt and deduplication are not verified by these logs.',
				'pixelpair'
			) }
		>
			{ settingsError && <Feedback error message={ settingsError } /> }
			{ error && ! confirm && <Feedback error message={ error } /> }
			{ message && <Feedback message={ message } /> }
			{ ! settings.logging_enabled && (
				<EmptyState
					action={
						<Button
							variant="primary"
							busy={ busy }
							busyLabel={ __( 'Turning on…', 'pixelpair' ) }
							onClick={ enable }
						>
							{ __( 'Turn on logging', 'pixelpair' ) }
						</Button>
					}
				>
					{ __(
						'Logging is off. Turn it on to record future server events.',
						'pixelpair'
					) }
				</EmptyState>
			) }
			<div className="pixelpair-activity-filters">
				<SelectField
					label={ __( 'Connection filter', 'pixelpair' ) }
					value={ platform }
					disabled={ busy }
					onChange={ ( next ) => {
						setPage( 1 );
						setPlatform( next );
					} }
					options={ [
						{
							value: '',
							label: __( 'All connections', 'pixelpair' ),
						},
						{ value: 'meta', label: 'Meta' },
						{ value: 'tiktok', label: 'TikTok' },
					] }
				/>
				<SelectField
					label={ __( 'Status filter', 'pixelpair' ) }
					value={ status }
					disabled={ busy }
					onChange={ ( next ) => {
						setPage( 1 );
						setStatus( next );
					} }
					options={ [
						{ value: '', label: __( 'All statuses', 'pixelpair' ) },
						...Object.entries( logStatuses ).map(
							( [ key, [ , label ] ] ) => ( {
								value: key,
								label,
							} )
						),
					] }
				/>
			</div>
			<div className="pixelpair-actions">
				<Button
					busy={ resource.loading }
					busyLabel={ __( 'Refreshing…', 'pixelpair' ) }
					disabled={ busy }
					onClick={ resource.refresh }
				>
					{ __( 'Refresh activity', 'pixelpair' ) }
				</Button>
				<Button
					disabled={
						blocked || !! resource.error || ! data?.items.length
					}
					onClick={ () =>
						downloadFile(
							'pixelpair-logs-page.csv',
							logsCsv( data.items ),
							'text/csv'
						)
					}
				>
					{ __( 'Download this page as CSV', 'pixelpair' ) }
				</Button>
				<Button
					variant="destructive"
					disabled={ blocked || ! data?.total }
					onClick={ () => setConfirm( true ) }
				>
					{ __( 'Clear logs', 'pixelpair' ) }
				</Button>
			</div>
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
			{ resource.loading && <Skeleton /> }
			{ ! resource.loading &&
				data &&
				( data.items.length ? (
					<table
						className="pixelpair-table pixelpair-activity-table"
						aria-label={ __( 'Server events', 'pixelpair' ) }
					>
						<thead>
							<tr>
								{ [
									__( 'Event and time', 'pixelpair' ),
									__( 'Connection', 'pixelpair' ),
									__( 'Status', 'pixelpair' ),
									__( 'Delivery', 'pixelpair' ),
									__( 'Details', 'pixelpair' ),
								].map( ( label ) => (
									<th key={ label } scope="col">
										{ label }
									</th>
								) ) }
							</tr>
						</thead>
						<tbody>
							{ data.items.map( ( row ) => (
								<tr key={ row.id }>
									<th scope="row">
										<strong>{ row.event_name }</strong>
										<br />
										<time className="pixelpair-helper">
											{ new Date(
												Number( row.created_at ) * 1000
											).toLocaleString() }
										</time>
									</th>
									<td
										data-label={ __(
											'Connection',
											'pixelpair'
										) }
									>
										{ { meta: 'Meta', tiktok: 'TikTok' }[
											row.platform
										] || row.platform }
									</td>
									<td
										data-label={ __(
											'Status',
											'pixelpair'
										) }
									>
										<StatusBadge
											status={
												logStatuses[
													row.status
												]?.[ 0 ] || 'neutral'
											}
										>
											{ logStatuses[
												row.status
											]?.[ 1 ] || row.status }
										</StatusBadge>
									</td>
									<td
										data-label={ __(
											'Delivery',
											'pixelpair'
										) }
									>
										<MatchIndicator
											state={ logMatchState(
												row.status
											) }
										/>
									</td>
									<td>
										<details className="pixelpair-inline-disclosure">
											<summary>
												{ __(
													'Show details',
													'pixelpair'
												) }
											</summary>
											<p>
												{ sprintf(
													/* translators: %1$s: HTTP response code. */ __(
														'HTTP response: %1$s',
														'pixelpair'
													),
													row.response_code ||
														__(
															'None',
															'pixelpair'
														)
												) }
											</p>
											<pre
												tabIndex="0"
												aria-label={ __(
													'Redacted request and response',
													'pixelpair'
												) }
											>
												{ logDetails( row.details ) }
											</pre>
										</details>
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				) : (
					settings.logging_enabled && (
						<EmptyState
							action={
								<Button
									onClick={ () => navigate( 'connections' ) }
								>
									{ __( 'Check a connection', 'pixelpair' ) }
								</Button>
							}
						>
							{ status || platform
								? __(
										'No events match these filters. Change a filter or check a connection.',
										'pixelpair'
									)
								: __(
										'No server events yet. Check a server connection to create your first log entry.',
										'pixelpair'
									) }
						</EmptyState>
					)
				) ) }
			{ data && data.total > 0 && (
				<div className="pixelpair-actions">
					<Button
						disabled={ blocked || page <= 1 }
						onClick={ () => setPage( page - 1 ) }
					>
						{ __( 'Previous page', 'pixelpair' ) }
					</Button>
					<span>
						{ sprintf(
							/* translators: %1$d: current page; %2$d: number of pages. */ __(
								'Page %1$d of %2$d',
								'pixelpair'
							),
							page,
							Math.ceil( data.total / 50 )
						) }
					</span>
					<Button
						disabled={ blocked || page * 50 >= data.total }
						onClick={ () => setPage( page + 1 ) }
					>
						{ __( 'Next page', 'pixelpair' ) }
					</Button>
				</div>
			) }
			{ confirm && (
				<ConfirmDialog
					title={ __( 'Clear all server logs?', 'pixelpair' ) }
					confirmLabel={ __( 'Clear all logs', 'pixelpair' ) }
					busy={ busy }
					error={ error }
					onCancel={ () => {
						setConfirm( false );
						setError( '' );
					} }
					onConfirm={ clear }
				>
					{ __(
						'This permanently deletes log history for every connection, including events outside the current filter.',
						'pixelpair'
					) }
				</ConfirmDialog>
			) }
		</Page>
	);
}
