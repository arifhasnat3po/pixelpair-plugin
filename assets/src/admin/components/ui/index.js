/** @jsxRuntime classic */
/** @jsx createElement */
import {
	createElement,
	cloneElement,
	useId,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import {
	Button as WPButton,
	CheckboxControl,
	Modal,
	Spinner,
} from '@wordpress/components';
import { speak } from '@wordpress/a11y';
import { __, sprintf } from '@wordpress/i18n';

export function Button( {
	variant = 'secondary',
	busy = false,
	busyLabel = __( 'Saving…', 'pixelpair' ),
	children,
	disabled,
	className = '',
	...props
} ) {
	return (
		<WPButton
			type="button"
			{ ...props }
			variant={ variant === 'destructive' ? 'secondary' : variant }
			isDestructive={ variant === 'destructive' }
			disabled={ disabled || busy }
			aria-busy={ busy || undefined }
			className={ `pixelpair-button pixelpair-button--${ variant } ${ className }` }
		>
			<span className="pixelpair-button__labels">
				<span
					className={ busy ? 'pixelpair-button__reserve' : '' }
					aria-hidden={ busy || undefined }
				>
					{ children }
				</span>
				<span
					className={ busy ? '' : 'pixelpair-button__reserve' }
					aria-hidden={ ! busy || undefined }
				>
					{ busyLabel }
				</span>
			</span>
			{ busy && (
				<span aria-hidden="true" className="pixelpair-button__spinner">
					<Spinner />
				</span>
			) }
		</WPButton>
	);
}

export function ExternalLink( {
	href,
	children = __( 'Learn more', 'pixelpair' ),
} ) {
	return (
		<a
			className="pixelpair-external"
			href={ href }
			target="_blank"
			rel="noopener noreferrer"
		>
			{ children }
			<svg
				aria-hidden="true"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7" />
			</svg>
			<span className="screen-reader-text">
				{ ' ' }
				{ __( '(opens in a new tab)', 'pixelpair' ) }
			</span>
		</a>
	);
}

export function Page( {
	title,
	description,
	status,
	back,
	action,
	brand,
	children,
} ) {
	const heading = useRef();
	useEffect( () => {
		heading.current?.focus( { preventScroll: true } );
	}, [ title ] );
	return (
		<section className="pixelpair-page">
			{ back && <div className="pixelpair-back">{ back }</div> }
			<header className="pixelpair-page__header">
				<div>
					{ brand }
					<h1 ref={ heading } tabIndex="-1">
						{ title }
					</h1>
					{ description && (
						<p className="pixelpair-description">{ description }</p>
					) }
					{ status }
				</div>
				{ action && (
					<div className="pixelpair-actions">{ action }</div>
				) }
			</header>
			{ children }
		</section>
	);
}

export function Section( {
	title,
	description,
	advanced = false,
	children,
	className = '',
} ) {
	if ( advanced ) {
		return (
			<details
				className={ `pixelpair-section pixelpair-advanced ${ className }` }
			>
				<summary>{ title || __( 'Advanced', 'pixelpair' ) }</summary>
				{ description && (
					<p className="pixelpair-description">{ description }</p>
				) }
				<div className="pixelpair-fields">{ children }</div>
			</details>
		);
	}
	return (
		<section className={ `pixelpair-section ${ className }` }>
			<h2>{ title }</h2>
			{ description && (
				<p className="pixelpair-description">{ description }</p>
			) }
			<div className="pixelpair-fields">{ children }</div>
		</section>
	);
}

export function Field( {
	label,
	help,
	error,
	children,
	id: suppliedId,
	className = '',
} ) {
	const unique = useId();
	const id = suppliedId || `pixelpair-field-${ unique }`;
	const describedBy = [
		children.props[ 'aria-describedby' ],
		help && `${ id }-help`,
		error && `${ id }-error`,
	]
		.filter( Boolean )
		.join( ' ' );
	return (
		<div className={ `pixelpair-field ${ className }` }>
			<label htmlFor={ id }>{ label }</label>
			{ cloneElement( children, {
				id,
				'aria-describedby': describedBy || undefined,
				'aria-invalid': error ? true : undefined,
			} ) }
			{ help && (
				<div id={ `${ id }-help` } className="pixelpair-help">
					{ help }
				</div>
			) }
			{ error && (
				<div
					id={ `${ id }-error` }
					className="pixelpair-field__error"
					role="alert"
				>
					{ error }
				</div>
			) }
		</div>
	);
}

export function StatusBadge( { status = 'neutral', children } ) {
	const marks = {
		success: '✓',
		warning: '!',
		error: '!',
		info: 'i',
		neutral: '–',
	};
	return (
		<span className={ `pixelpair-status pixelpair-status--${ status }` }>
			<span aria-hidden="true" className="pixelpair-status__icon">
				{ marks[ status ] || marks.neutral }
			</span>
			{ children }
		</span>
	);
}

export function MatchIndicator( { state = 'unverified' } ) {
	const labels = {
		unverified: __( 'Match not verified', 'pixelpair' ),
		matched: __( 'Matched', 'pixelpair' ),
		browser: __( 'Browser only', 'pixelpair' ),
		accepted: __( 'Server accepted', 'pixelpair' ),
		failed: __( 'Server failed', 'pixelpair' ),
	};
	return (
		<span className={ `pixelpair-match pixelpair-match--${ state }` }>
			<span aria-hidden="true" className="pixelpair-match__dots">
				<i />
				<i />
			</span>
			{ labels[ state ] || labels.unverified }
		</span>
	);
}

export function Feedback( {
	error = false,
	children,
	message,
	action,
	status = 'success',
} ) {
	useEffect( () => {
		if ( message ) {
			speak( message, error ? 'assertive' : 'polite' );
		}
	}, [ message, error ] );
	return (
		<div
			role={ error ? 'alert' : 'status' }
			className={ `pixelpair-feedback pixelpair-feedback--${ error ? 'error' : status }` }
		>
			{ message || children }
			{ action }
		</div>
	);
}

export function useUnsavedChanges( dirty, busy = false ) {
	useEffect( () => {
		if ( ! dirty && ! busy ) {
			return;
		}
		const unload = ( event ) => {
			event.preventDefault();
			event.returnValue = '';
		};
		const route = ( event ) => {
			event.preventDefault();
			event.detail.busy = event.detail.busy || busy;
		};
		window.addEventListener( 'beforeunload', unload );
		window.addEventListener( 'pixelpair:before-route', route );
		return () => {
			window.removeEventListener( 'beforeunload', unload );
			window.removeEventListener( 'pixelpair:before-route', route );
		};
	}, [ dirty, busy ] );
}

export function SaveBar( {
	dirty,
	busy,
	onSave,
	onDiscard,
	disabled,
	label = __( 'Save changes', 'pixelpair' ),
} ) {
	useUnsavedChanges( dirty, busy );
	if ( ! dirty ) {
		return null;
	}
	return (
		<div className="pixelpair-savebar">
			<p>{ __( 'You have unsaved changes.', 'pixelpair' ) }</p>
			<div className="pixelpair-actions">
				<Button
					onClick={ onDiscard }
					disabled={ busy }
					variant="tertiary"
				>
					{ __( 'Discard', 'pixelpair' ) }
				</Button>
				<Button
					variant="primary"
					busy={ busy }
					disabled={ disabled }
					onClick={ onSave }
					type={ onSave ? 'button' : 'submit' }
				>
					{ label }
				</Button>
			</div>
		</div>
	);
}

export function ToggleRow( {
	label,
	description,
	platforms = [],
	checked,
	onChange,
	detail,
	disabled = false,
} ) {
	const [ busy, setBusy ] = useState( false );
	const [ previous, setPrevious ] = useState( null );
	const [ message, setMessage ] = useState( '' );
	const [ error, setError ] = useState( false );
	const change = async ( next, undo = false ) => {
		if ( busy ) {
			return;
		}
		setBusy( true );
		setMessage( '' );
		setError( false );
		try {
			if ( ( await onChange( next ) ) === false ) {
				throw new Error();
			}
			setPrevious( undo ? null : checked );
			const changedMessage = next
				? sprintf(
						/* translators: %1$s: event name. */ __(
							'%1$s turned on.',
							'pixelpair'
						),
						label
					)
				: sprintf(
						/* translators: %1$s: event name. */ __(
							'%1$s turned off.',
							'pixelpair'
						),
						label
					);
			setMessage(
				undo ? __( 'Change undone.', 'pixelpair' ) : changedMessage
			);
		} catch {
			setError( true );
			setMessage(
				sprintf(
					/* translators: %1$s: event name. */
					__( 'Could not update %1$s. Try again.', 'pixelpair' ),
					label
				)
			);
		} finally {
			setBusy( false );
		}
	};
	return (
		<div className="pixelpair-toggle-row">
			<div className="pixelpair-toggle-row__line">
				<div>
					<strong>{ label }</strong>
					{ description && (
						<p className="pixelpair-description">{ description }</p>
					) }
					<div className="pixelpair-chips">
						{ platforms.map( ( platform ) => (
							<span key={ platform }>{ platform }</span>
						) ) }
					</div>
				</div>
				<div className="pixelpair-actions">
					{ detail }
					<CheckboxControl
						label={ label }
						className="pixelpair-row-toggle"
						checked={ checked }
						disabled={ busy || disabled }
						onChange={ ( next ) => change( next ) }
					/>
				</div>
			</div>
			{ message && (
				<Feedback
					error={ error }
					message={ message }
					action={
						! error &&
						previous !== null && (
							<Button
								variant="tertiary"
								disabled={ busy }
								onClick={ () => change( previous, true ) }
							>
								{ __( 'Undo', 'pixelpair' ) }
							</Button>
						)
					}
				/>
			) }
		</div>
	);
}

export function RuleSentence( { children } ) {
	return <div className="pixelpair-rule-sentence">{ children }</div>;
}
export function PayloadPreview( { payloads } ) {
	return (
		<details className="pixelpair-payload">
			<summary>{ __( "Show what's sent", 'pixelpair' ) }</summary>
			{ Object.entries( payloads ).map( ( [ name, payload ] ) => (
				<div key={ name }>
					<h3>{ name }</h3>
					<pre>
						{ typeof payload === 'string'
							? payload
							: JSON.stringify( payload, null, 2 ) }
					</pre>
				</div>
			) ) }
		</details>
	);
}
export function EmptyState( { children, action } ) {
	return (
		<div className="pixelpair-empty">
			<p>{ children }</p>
			{ action }
		</div>
	);
}
export function ConfirmDialog( {
	title,
	children,
	error,
	onConfirm,
	onCancel,
	busy,
	confirmLabel = __( 'Delete', 'pixelpair' ),
	destructive = true,
} ) {
	return (
		<Modal
			title={ title }
			onRequestClose={ busy ? () => {} : onCancel }
			className="pixelpair-dialog"
		>
			<p>{ children }</p>
			{ error && <Feedback error message={ error } /> }
			<div className="pixelpair-actions">
				<Button onClick={ onCancel } disabled={ busy }>
					{ __( 'Cancel', 'pixelpair' ) }
				</Button>
				<Button
					variant={ destructive ? 'destructive' : 'primary' }
					busy={ busy }
					onClick={ onConfirm }
				>
					{ confirmLabel }
				</Button>
			</div>
		</Modal>
	);
}
export function Skeleton( { label = __( 'Loading settings…', 'pixelpair' ) } ) {
	return (
		<div className="pixelpair-skeleton" role="status" aria-label={ label }>
			<span className="screen-reader-text">{ label }</span>
			<i />
			<i />
			<i />
			<i />
		</div>
	);
}
