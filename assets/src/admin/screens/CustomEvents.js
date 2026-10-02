/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState, lazy, Suspense } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Button,
	Feedback,
	EmptyState,
	Skeleton,
	StatusBadge,
	ConfirmDialog,
	useUnsavedChanges,
} from '../components/ui';
import EventTabs from '../components/EventTabs';
import { useResource } from '../data/useResource';
import { providers } from '../data/connections';
import { triggerSummary, newRule } from '../data/customEvents';
const Editor = lazy( () => import( './CustomEventEditor' ) );
export default function CustomEvents( { route, navigate, settings } ) {
	const resource = useResource( '/pixelpair/v1/events' );
	const [ busy, setBusy ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ message, setMessage ] = useState( '' );
	const [ undo, setUndo ] = useState( null );
	const [ deleting, setDeleting ] = useState( null );
	const id = route.split( '/' )[ 2 ];
	const editing = !! id;
	const rule =
		id === 'new'
			? newRule()
			: resource.data?.find( ( item ) => String( item.id ) === id );
	useUnsavedChanges( false, !! busy && ! editing );
	const mutate = async (
		target,
		data,
		method = 'POST',
		operation = 'save'
	) => {
		if ( busy ) {
			return false;
		}
		setBusy( `${ target }/${ operation }` );
		setError( '' );
		setMessage( '' );
		try {
			const result = await apiFetch( {
				path: `/pixelpair/v1/events${ target ? `/${ target }` : '' }`,
				method,
				data,
			} );
			resource.setData( ( current ) =>
				method === 'DELETE'
					? current.filter( ( item ) => item.id !== target )
					: [
							result,
							...( current || [] ).filter(
								( item ) => item.id !== result.id
							),
						]
			);
			setDeleting( null );
			return true;
		} catch ( problem ) {
			setError(
				problem.message ||
					__( 'Could not update this event. Try again.', 'pixelpair' )
			);
			return false;
		} finally {
			setBusy( '' );
		}
	};
	const changeStatus = async ( target, status, isUndo = false ) => {
		if (
			await mutate( target.id, { ...target, status }, 'POST', 'status' )
		) {
			setUndo( isUndo ? null : { id: target.id, status: target.status } );
			let notice =
				status === 'active'
					? sprintf(
							/* translators: %1$s: event name. */ __(
								'“%1$s” turned on.',
								'pixelpair'
							),
							target.name
						)
					: sprintf(
							/* translators: %1$s: event name. */ __(
								'“%1$s” turned off.',
								'pixelpair'
							),
							target.name
						);
			if ( isUndo ) {
				notice = __( 'Change undone.', 'pixelpair' );
			}
			setMessage( notice );
		}
	};
	const create = () => navigate( 'events/custom/new' );
	return (
		<Page
			title={
				editing
					? __( 'Custom event', 'pixelpair' )
					: __( 'Events', 'pixelpair' )
			}
			description={
				editing
					? undefined
					: __(
							'Track the actions that matter to your business.',
							'pixelpair'
						)
			}
			back={
				editing ? (
					<Button
						variant="tertiary"
						onClick={ () => navigate( 'events/custom' ) }
					>
						{ __( 'Back to Events', 'pixelpair' ) }
					</Button>
				) : undefined
			}
			action={
				! editing && resource.data?.length ? (
					<Button
						variant="primary"
						disabled={ !! busy }
						onClick={ create }
					>
						{ __( 'New event', 'pixelpair' ) }
					</Button>
				) : undefined
			}
		>
			{ ! editing && (
				<EventTabs current="events/custom" navigate={ navigate } />
			) }
			{ resource.error && (
				<Feedback
					error
					message={ resource.error }
					action={
						<Button
							onClick={ resource.refresh }
							busy={ resource.loading }
							busyLabel={ __( 'Loading…', 'pixelpair' ) }
						>
							{ __( 'Retry', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			{ error && ! editing && <Feedback error message={ error } /> }
			{ message && (
				<Feedback
					message={ message }
					action={
						undo && (
							<Button
								variant="tertiary"
								disabled={ !! busy }
								onClick={ () => {
									const latest = resource.data.find(
										( item ) => item.id === undo.id
									);
									if ( latest ) {
										changeStatus(
											latest,
											undo.status,
											true
										);
									}
								} }
							>
								{ __( 'Undo', 'pixelpair' ) }
							</Button>
						)
					}
				/>
			) }
			{ resource.loading && ! resource.data && id !== 'new' && (
				<Skeleton label={ __( 'Loading events…', 'pixelpair' ) } />
			) }
			{ editing && rule && (
				<Suspense fallback={ <Skeleton /> }>
					<Editor
						settings={ settings }
						key={ id }
						initial={ rule }
						busy={ !! busy }
						error={ error }
						onComplete={ () => navigate( 'events/custom' ) }
						onSave={ ( draft ) => mutate( draft.id, draft ) }
					/>
				</Suspense>
			) }
			{ editing && ! rule && resource.data && (
				<EmptyState
					action={
						<Button onClick={ () => navigate( 'events/custom' ) }>
							{ __( 'Open custom events', 'pixelpair' ) }
						</Button>
					}
				>
					{ __(
						'This event is no longer available. Choose another event to edit.',
						'pixelpair'
					) }
				</EmptyState>
			) }
			{ ! editing && resource.data?.length === 0 && (
				<EmptyState
					action={
						<Button variant="primary" onClick={ create }>
							{ __( 'Create an event', 'pixelpair' ) }
						</Button>
					}
				>
					{ __(
						'No custom events yet. Track button clicks, page visits, or scroll depth without code.',
						'pixelpair'
					) }
				</EmptyState>
			) }
			{ ! editing && !! resource.data?.length && (
				<table className="pixelpair-table">
					<caption className="screen-reader-text">
						{ __( 'Custom events', 'pixelpair' ) }
					</caption>
					<thead>
						<tr>
							{ [
								__( 'Name', 'pixelpair' ),
								__( 'When it happens', 'pixelpair' ),
								__( 'Connections', 'pixelpair' ),
								__( 'Status', 'pixelpair' ),
								__( 'Actions', 'pixelpair' ),
							].map( ( label ) => (
								<th key={ label } scope="col">
									{ label }
								</th>
							) ) }
						</tr>
					</thead>
					<tbody>
						{ resource.data.map( ( item ) => (
							<tr key={ item.id }>
								<th scope="row">{ item.name }</th>
								<td
									data-label={ __(
										'When it happens',
										'pixelpair'
									) }
								>
									{ triggerSummary( item ) }
								</td>
								<td
									data-label={ __(
										'Connections',
										'pixelpair'
									) }
								>
									<div className="pixelpair-chips">
										{ Object.entries( providers )
											.filter(
												( [ key ] ) =>
													item.platforms[ key ]
														?.enabled
											)
											.map( ( [ key, provider ] ) => (
												<span key={ key }>
													{ provider.name }
												</span>
											) ) }
									</div>
								</td>
								<td data-label={ __( 'Status', 'pixelpair' ) }>
									<StatusBadge
										status={
											item.status === 'active'
												? 'info'
												: 'neutral'
										}
									>
										{ item.status === 'active'
											? __( 'On', 'pixelpair' )
											: __( 'Off', 'pixelpair' ) }
									</StatusBadge>
								</td>
								<td>
									<div className="pixelpair-actions">
										<Button
											variant="tertiary"
											disabled={ !! busy }
											onClick={ () =>
												navigate(
													`events/custom/${ item.id }`
												)
											}
										>
											{ __( 'Edit', 'pixelpair' ) }
										</Button>
										<Button
											variant="tertiary"
											disabled={ !! busy }
											busy={
												busy === `${ item.id }/status`
											}
											busyLabel={ __(
												'Updating…',
												'pixelpair'
											) }
											onClick={ () =>
												changeStatus(
													item,
													item.status === 'active'
														? 'paused'
														: 'active'
												)
											}
										>
											{ item.status === 'active'
												? __( 'Turn off', 'pixelpair' )
												: __( 'Turn on', 'pixelpair' ) }
										</Button>
										<details className="pixelpair-row-actions">
											<summary>
												{ __( 'More', 'pixelpair' ) }
											</summary>
											<div className="pixelpair-actions">
												<Button
													variant="tertiary"
													disabled={ !! busy }
													busy={
														busy ===
														`${ item.id }/duplicate`
													}
													busyLabel={ __(
														'Duplicating…',
														'pixelpair'
													) }
													onClick={ async () => {
														if (
															await mutate(
																item.id,
																{
																	action: 'duplicate',
																},
																'POST',
																'duplicate'
															)
														) {
															setUndo( null );
															setMessage(
																__(
																	'Event duplicated. The copy is turned off.',
																	'pixelpair'
																)
															);
														}
													} }
												>
													{ __(
														'Duplicate',
														'pixelpair'
													) }
												</Button>
												<Button
													variant="destructive"
													disabled={ !! busy }
													onClick={ () =>
														setDeleting( item )
													}
												>
													{ __(
														'Delete',
														'pixelpair'
													) }
												</Button>
											</div>
										</details>
									</div>
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }
			{ deleting && (
				<ConfirmDialog
					title={ sprintf(
						/* translators: %1$s: event name. */ __(
							'Delete “%1$s”?',
							'pixelpair'
						),
						deleting.name
					) }
					confirmLabel={ __( 'Delete event', 'pixelpair' ) }
					busy={ !! busy }
					onCancel={ () => setDeleting( null ) }
					onConfirm={ async () => {
						if (
							await mutate(
								deleting.id,
								{ confirm: 'yes' },
								'DELETE',
								'delete'
							)
						) {
							setUndo( null );
							setMessage( __( 'Event deleted.', 'pixelpair' ) );
						}
					} }
				>
					{ __(
						'This removes this event and its tracking rule.',
						'pixelpair'
					) }
				</ConfirmDialog>
			) }
		</Page>
	);
}
