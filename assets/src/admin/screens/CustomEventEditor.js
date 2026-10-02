/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState, useEffect, useId } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Section,
	RuleSentence,
	Button,
	SaveBar,
	Feedback,
} from '../components/ui';
import { TextField, SelectField, CheckField } from '../components/ui/fields';
import EventMapping from '../components/EventMapping';
import { validMappings } from '../data/events';
import {
	triggerChoices,
	conditionChoices,
	choices,
	freshTrigger,
	numericTriggers,
	delayedTriggers,
	triggerError,
	conditionError,
} from '../data/rules';

function Trigger( { row, index, change, remove, canRemove } ) {
	const [ touched, setTouched ] = useState( false );
	const numeric = numericTriggers.includes( row.type );
	const maximum = row.type === 'scroll' ? 100 : 3600;
	const selector = [ 'click', 'mouseover', 'visible' ].includes( row.type );
	const errors = triggerError( row );
	const labels = {
		url: __( 'A URL matching', 'pixelpair' ),
		link: __( 'A link matching', 'pixelpair' ),
		scroll: __( 'Percentage', 'pixelpair' ),
		time: __( 'Seconds', 'pixelpair' ),
		page_count: __( 'Page views', 'pixelpair' ),
		post_type: __( 'Content type', 'pixelpair' ),
		posts: __( 'Page IDs', 'pixelpair' ),
		terms: __( 'Category or tag', 'pixelpair' ),
		url_param: __( 'Parameter value', 'pixelpair' ),
	};
	const help = {
		scroll: __(
			'Send when the visitor reaches this percentage, from 1 to 100.',
			'pixelpair'
		),
		time: __(
			'Count visible time only, from 1 to 3600 seconds.',
			'pixelpair'
		),
		page_count: __(
			'Count pages in this session, from 1 to 3600.',
			'pixelpair'
		),
		post_type: __(
			'Use a registered slug, such as post, page or product.',
			'pixelpair'
		),
		posts: __(
			'Enter page IDs separated by commas, such as 12,34.',
			'pixelpair'
		),
		terms: __(
			'Use taxonomy:id, such as category:12 or post_tag:34.',
			'pixelpair'
		),
	};
	return (
		<div className="pixelpair-rule-row">
			<RuleSentence>
				<SelectField
					label={
						index
							? __( 'Or when', 'pixelpair' )
							: __( 'When', 'pixelpair' )
					}
					value={ row.type }
					options={ choices( triggerChoices ) }
					onChange={ ( type ) =>
						change( freshTrigger( type ), true )
					}
				/>
				{ [ 'url', 'link', 'url_param' ].includes( row.type ) && (
					<SelectField
						label={ __( 'Match', 'pixelpair' ) }
						value={ row.operator }
						options={ choices(
							row.type === 'url_param'
								? [
										[
											'present',
											__( 'is present', 'pixelpair' ),
										],
										[
											'equals',
											__( 'equals', 'pixelpair' ),
										],
									]
								: [
										[
											'contains',
											__( 'contains', 'pixelpair' ),
										],
										[
											'equals',
											__( 'equals', 'pixelpair' ),
										],
										[
											'starts',
											__( 'starts with', 'pixelpair' ),
										],
										[
											'regex',
											__(
												'matches a regular expression',
												'pixelpair'
											),
										],
									]
						) }
						onChange={ ( operator ) => change( { operator } ) }
					/>
				) }
				{ row.type === 'url_param' && (
					<TextField
						label={ __( 'Parameter name', 'pixelpair' ) }
						value={ row.key }
						onChange={ ( key ) => change( { key } ) }
						error={ errors }
					/>
				) }
				{ row.type !== 'home' &&
					! (
						row.type === 'url_param' && row.operator === 'present'
					) && (
						<TextField
							label={
								selector
									? __( 'An element matching', 'pixelpair' )
									: labels[ row.type ]
							}
							value={ row.value }
							type={ numeric ? 'number' : 'text' }
							min={ numeric ? 1 : undefined }
							max={ numeric ? maximum : undefined }
							onChange={ ( value ) =>
								change( {
									value: numeric ? Number( value ) : value,
								} )
							}
							onBlur={ () => setTouched( true ) }
							error={
								row.type !== 'url_param' &&
								( row.value !== '' || touched )
									? errors
									: ''
							}
							help={
								selector
									? __(
											'Use a CSS selector, such as .book-call-btn, #contact or button.submit.',
											'pixelpair'
										)
									: help[ row.type ]
							}
						/>
					) }
			</RuleSentence>
			{ [ 'url', 'link' ].includes( row.type ) && (
				<p className="pixelpair-help">
					{ __(
						'Rules match visitor URLs; published-page matches have not been checked.',
						'pixelpair'
					) }
				</p>
			) }
			<div className="pixelpair-actions">
				{ canRemove && (
					<Button variant="tertiary" onClick={ remove }>
						{ __( 'Remove action', 'pixelpair' ) }
					</Button>
				) }
			</div>
			{ delayedTriggers.includes( row.type ) && (
				<details className="pixelpair-inline-disclosure">
					<summary>{ __( 'Add a delay', 'pixelpair' ) }</summary>
					<TextField
						label={ __( 'Delay in visible seconds', 'pixelpair' ) }
						value={ row.delay || 0 }
						type="number"
						min="0"
						max="3600"
						onChange={ ( delay ) =>
							change( { delay: Number( delay ) } )
						}
						error={
							row.delay < 0 || row.delay > 3600 ? errors : ''
						}
						help={ __(
							'Wait while the page is visible before sending this event.',
							'pixelpair'
						) }
					/>
				</details>
			) }
		</div>
	);
}
function Condition( { row, index, change, remove } ) {
	const roleList = useId();
	return (
		<div className="pixelpair-rule-row">
			<RuleSentence>
				<SelectField
					label={
						index
							? __( 'And', 'pixelpair' )
							: __( 'Only if', 'pixelpair' )
					}
					options={ choices( conditionChoices ) }
					value={ row.type }
					onChange={ ( type ) =>
						change(
							{
								type,
								value:
									{ device: 'desktop', role: 'logged-out' }[
										type
									] || '',
							},
							true
						)
					}
				/>
				{ row.type === 'device' ? (
					<SelectField
						label={ __( 'Device', 'pixelpair' ) }
						value={ row.value }
						options={ choices( [
							[ 'desktop', __( 'Desktop', 'pixelpair' ) ],
							[ 'mobile', __( 'Mobile', 'pixelpair' ) ],
							[ 'tablet', __( 'Tablet', 'pixelpair' ) ],
						] ) }
						onChange={ ( value ) => change( { value } ) }
					/>
				) : (
					<TextField
						label={
							row.type === 'role'
								? __( 'User role', 'pixelpair' )
								: __( 'Matches', 'pixelpair' )
						}
						value={ row.value }
						onChange={ ( value ) => change( { value } ) }
						error={ conditionError( row ) }
						list={ row.type === 'role' ? roleList : undefined }
						help={
							row.type === 'role'
								? __(
										'Choose a role slug; logged-out means visitors who have not signed in.',
										'pixelpair'
									)
								: undefined
						}
					/>
				) }
				<Button variant="tertiary" onClick={ remove }>
					{ __( 'Remove condition', 'pixelpair' ) }
				</Button>
			</RuleSentence>
			<datalist id={ roleList }>
				<option value="logged-out">
					{ __( 'Signed out', 'pixelpair' ) }
				</option>
				{ ( window.pixelpairAdmin?.roles || [] ).map( ( role ) => (
					<option key={ role.slug } value={ role.slug }>
						{ role.name }
					</option>
				) ) }
			</datalist>
		</div>
	);
}
export default function CustomEventEditor( {
	initial,
	settings,
	onSave,
	onComplete,
	busy,
	error,
} ) {
	const [ rule, setRule ] = useState( initial );
	const [ pending, setPending ] = useState( false );
	const [ complete, setComplete ] = useState( false );
	const [ problem, setProblem ] = useState( '' );
	const baseline = JSON.stringify( initial );
	const dirty = ! complete && JSON.stringify( rule ) !== baseline;
	const nameInvalid =
		! rule.name.trim() ||
		new TextEncoder().encode( rule.name ).length > 120;
	const invalid =
		nameInvalid ||
		! validMappings( rule.platforms ) ||
		! rule.triggers.length ||
		rule.triggers.some( triggerError ) ||
		rule.conditions.some( conditionError );
	const patch = ( value ) => {
		setRule( ( old ) => ( { ...old, ...value } ) );
		setProblem( '' );
	};
	const rowChange = ( key, index, value, replace = false ) =>
		patch( {
			[ key ]: rule[ key ].map( ( old, i ) => {
				if ( i !== index ) {
					return old;
				}
				return replace ? value : { ...old, ...value };
			} ),
		} );
	const remove = ( key, index ) =>
		patch( { [ key ]: rule[ key ].filter( ( _, i ) => i !== index ) } );
	useEffect( () => {
		if ( complete ) {
			onComplete?.();
		}
	}, [ complete, onComplete ] );
	const submit = async ( event ) => {
		event.preventDefault();
		if ( invalid || pending || busy ) {
			return;
		}
		setPending( true );
		setProblem( '' );
		try {
			if ( await onSave( rule ) ) {
				setComplete( true );
			}
		} catch ( e ) {
			setProblem(
				e.message ||
					__( 'Could not save this event. Try again.', 'pixelpair' )
			);
		} finally {
			setPending( false );
		}
	};
	return (
		<form onSubmit={ submit }>
			{ ( error || problem ) && (
				<Feedback error message={ error || problem } />
			) }
			<fieldset
				className="pixelpair-fieldset"
				disabled={ pending || busy }
			>
				<div className="pixelpair-fields">
					<TextField
						label={ __( 'Event name', 'pixelpair' ) }
						value={ rule.name }
						onChange={ ( name ) => patch( { name } ) }
						required
						error={
							rule.name && nameInvalid
								? __(
										'Shorten the event name and try again.',
										'pixelpair'
									)
								: ''
						}
					/>
					<CheckField
						label={ __( 'Turn on this event', 'pixelpair' ) }
						checked={ rule.status === 'active' }
						onChange={ ( enabled ) =>
							patch( { status: enabled ? 'active' : 'paused' } )
						}
					/>
				</div>
				<Section
					title={ __( 'When it happens', 'pixelpair' ) }
					description={ __(
						'Any one of these actions can start this event.',
						'pixelpair'
					) }
				>
					{ rule.triggers.map( ( row, index ) => (
						<Trigger
							key={ index }
							row={ row }
							index={ index }
							change={ ( value, replace ) =>
								rowChange( 'triggers', index, value, replace )
							}
							remove={ () => remove( 'triggers', index ) }
							canRemove={ rule.triggers.length > 1 }
						/>
					) ) }
					<div>
						<Button
							disabled={ rule.triggers.length >= 20 }
							onClick={ () =>
								patch( {
									triggers: [
										...rule.triggers,
										freshTrigger( 'url' ),
									],
								} )
							}
						>
							{ __( 'Add another action', 'pixelpair' ) }
						</Button>
					</div>
				</Section>
				<Section
					title={ __( 'On these pages', 'pixelpair' ) }
					description={
						rule.conditions.length
							? __(
									'Every condition must match before the event sends.',
									'pixelpair'
								)
							: __(
									'Any page. Add a condition to narrow who or where you track.',
									'pixelpair'
								)
					}
				>
					{ rule.conditions.map( ( row, index ) => (
						<Condition
							key={ index }
							row={ row }
							index={ index }
							change={ ( value, replace ) =>
								rowChange( 'conditions', index, value, replace )
							}
							remove={ () => remove( 'conditions', index ) }
						/>
					) ) }
					<div>
						<Button
							disabled={ rule.conditions.length >= 20 }
							onClick={ () =>
								patch( {
									conditions: [
										...rule.conditions,
										{ type: 'device', value: 'desktop' },
									],
								} )
							}
						>
							{ __( 'Add condition', 'pixelpair' ) }
						</Button>
					</div>
				</Section>
				<Section
					title={ __( 'Where to send', 'pixelpair' ) }
					description={ __(
						'Choose each connection and the event it should receive.',
						'pixelpair'
					) }
				>
					<EventMapping
						settings={ settings }
						value={ rule.platforms }
						onChange={ ( platforms ) => patch( { platforms } ) }
					/>
				</Section>
				<Section advanced>
					<CheckField
						label={ __( 'Send once per session', 'pixelpair' ) }
						checked={ rule.once_per_session }
						onChange={ ( value ) =>
							patch( { once_per_session: value } )
						}
						help={ __(
							'Prevent this event from repeating across pages in the same session.',
							'pixelpair'
						) }
					/>
					<details className="pixelpair-inline-disclosure">
						<summary>
							{ __( 'Show rule definition', 'pixelpair' ) }
						</summary>
						<pre
							aria-label={ __( 'Rule definition', 'pixelpair' ) }
						>
							{ JSON.stringify( rule, null, 2 ) }
						</pre>
					</details>
				</Section>
			</fieldset>
			<SaveBar
				dirty={ dirty }
				busy={ pending || busy }
				disabled={ invalid }
				onDiscard={ () => {
					setRule( initial );
					setProblem( '' );
				} }
				label={
					! initial.id && rule.status === 'active'
						? __( 'Save and turn on', 'pixelpair' )
						: __( 'Save changes', 'pixelpair' )
				}
			/>
		</form>
	);
}
