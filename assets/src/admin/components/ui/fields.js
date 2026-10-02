/** @jsxRuntime classic */
/** @jsx createElement */
import {
	createElement,
	Fragment,
	useState,
	useEffect,
} from '@wordpress/element';
import { CheckboxControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Field, ExternalLink, Feedback } from './index';
import { links } from '../../links';

const formats = {
	meta: /^\d{15,16}$/,
	ga4: /^G-[A-Z0-9]{4,20}$/,
	gtm: /^GTM-[A-Z0-9]{4,20}$/,
	tiktok: /^[A-Z0-9]{20}$/,
};
const labels = {
	meta: __( 'Pixel ID', 'pixelpair' ),
	ga4: __( 'Measurement IDs', 'pixelpair' ),
	gtm: __( 'Container ID', 'pixelpair' ),
	tiktok: __( 'Pixel ID', 'pixelpair' ),
};
const help = {
	meta: __(
		'Find your ID in Events Manager, under Data sources.',
		'pixelpair'
	),
	ga4: __(
		'Find your measurement ID in Analytics, under Data streams.',
		'pixelpair'
	),
	gtm: __( 'Find your container ID in Tag Manager.', 'pixelpair' ),
	tiktok: __( 'Find your pixel ID in TikTok Events Manager.', 'pixelpair' ),
};

export function validId( platform, value, required = false ) {
	const ids = String( value || '' )
		.split( /[,\s]+/ )
		.filter( Boolean );
	return ids.length
		? ( platform === 'ga4' ? ids.length <= 10 : ids.length === 1 ) &&
				ids.every( ( id ) => formats[ platform ].test( id ) )
		: ! required;
}
export function extractIds( platform, input ) {
	let ids = [];
	if ( platform === 'meta' ) {
		ids = Array.from(
			input.matchAll( /fbq\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/g ),
			( match ) => match[ 1 ]
		);
	}
	if ( platform === 'ga4' || platform === 'gtm' ) {
		ids =
			input.match(
				platform === 'ga4' ? /\bG-[A-Z0-9]+\b/g : /\bGTM-[A-Z0-9]+\b/g
			) || [];
	}
	if ( platform === 'tiktok' ) {
		ids = Array.from(
			input.matchAll( /ttq\.load\(\s*['"]([A-Z0-9]{20})['"]/g ),
			( match ) => match[ 1 ]
		);
	}
	return [ ...new Set( ids ) ];
}
export function IdField( {
	platform,
	value,
	onChange,
	required = false,
	label = labels[ platform ],
	error: suppliedError,
} ) {
	const [ message, setMessage ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ editing, setEditing ] = useState( false );
	const [ inputValue, setInputValue ] = useState( value || '' );
	useEffect( () => {
		if ( ! editing ) {
			setInputValue( value || '' );
		}
	}, [ value, editing ] );
	const parse = ( input ) => {
		setMessage( '' );
		setError( '' );
		const ids = /[<>()'"=]/.test( input )
			? extractIds( platform, input )
			: [];
		if ( ids.length > 1 && platform !== 'ga4' ) {
			setInputValue( input );
			onChange( input );
			setError(
				__(
					'We found more than one ID. Paste the one you want to connect.',
					'pixelpair'
				)
			);
			return;
		}
		const next = ids.length ? ids.join( ', ' ) : input;
		setInputValue( next );
		onChange( next );
		if ( ids.length && next !== input.trim() ) {
			setMessage(
				sprintf(
					/* translators: %1$s: extracted platform IDs. */
					__( 'We found %1$s in the code you pasted.', 'pixelpair' ),
					next
				)
			);
		}
		if ( ! validId( platform, next, required ) ) {
			setError(
				sprintf(
					/* translators: %1$s: ID field label. */ __(
						'Enter a valid %1$s.',
						'pixelpair'
					),
					label
				)
			);
		}
	};
	return (
		<div>
			<Field
				label={ label }
				error={ error || suppliedError }
				help={
					<Fragment>
						{ help[ platform ] }{ ' ' }
						<ExternalLink href={ links[ `${ platform }Id` ] } />
					</Fragment>
				}
			>
				<input
					className="regular-text"
					value={ inputValue }
					onFocus={ () => setEditing( true ) }
					onBlur={ () => setEditing( false ) }
					onChange={ ( event ) => parse( event.target.value ) }
					autoComplete="off"
					spellCheck="false"
					required={ required }
				/>
			</Field>
			{ message && <Feedback message={ message } /> }
		</div>
	);
}
export function SecretField( {
	configured,
	value,
	onChange,
	platform = 'meta',
} ) {
	const [ replacing, setReplacing ] = useState( ! configured );
	return configured && ! replacing ? (
		<div className="pixelpair-field">
			<span className="pixelpair-label">
				{ __( 'Access token', 'pixelpair' ) }
			</span>
			<div className="pixelpair-actions">
				<span aria-hidden="true">••••••••</span>
				<span>{ __( 'Token saved', 'pixelpair' ) }</span>
				<Button
					variant="tertiary"
					onClick={ () => setReplacing( true ) }
				>
					{ __( 'Replace token', 'pixelpair' ) }
				</Button>
			</div>
		</div>
	) : (
		<Field
			label={ __( 'Access token', 'pixelpair' ) }
			help={
				<Fragment>
					{ __(
						'Create a token in Events Manager to send server events.',
						'pixelpair'
					) }{ ' ' }
					<ExternalLink href={ links[ `${ platform }Token` ] } />
				</Fragment>
			}
		>
			<input
				type="password"
				value={ value }
				onChange={ ( event ) => onChange( event.target.value ) }
				autoComplete="new-password"
				spellCheck="false"
			/>
		</Field>
	);
}
export function TextField( {
	label,
	help: description,
	error,
	value,
	onChange,
	multiline = false,
	...props
} ) {
	return (
		<Field label={ label } help={ description } error={ error }>
			{ multiline ? (
				<textarea
					{ ...props }
					value={ value ?? '' }
					onChange={ ( event ) => onChange( event.target.value ) }
				/>
			) : (
				<input
					{ ...props }
					value={ value ?? '' }
					onChange={ ( event ) => onChange( event.target.value ) }
				/>
			) }
		</Field>
	);
}
export function SelectField( {
	label,
	help: description,
	value,
	onChange,
	options,
	...props
} ) {
	return (
		<Field label={ label } help={ description }>
			<select
				{ ...props }
				value={ value }
				onChange={ ( event ) => onChange( event.target.value ) }
			>
				{ options.map( ( option ) => (
					<option key={ option.value } value={ option.value }>
						{ option.label }
					</option>
				) ) }
			</select>
		</Field>
	);
}
export function CheckField( {
	label,
	help: description,
	checked,
	onChange,
	...props
} ) {
	return (
		<CheckboxControl
			{ ...props }
			className="pixelpair-check"
			label={ label }
			help={ description }
			checked={ !! checked }
			onChange={ onChange }
			__nextHasNoMarginBottom
		/>
	);
}
