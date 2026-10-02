/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState, useId } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, PayloadPreview } from './ui';
import { TextField, CheckField, SelectField } from './ui/fields';
import { providers } from '../data/connections';
import {
	validEventName,
	validParameterName,
	validParameterValue,
	standardMetaEvents,
	contextLabels,
} from '../data/events';

export default function EventMapping( {
	value,
	onChange,
	pageView = false,
	settings = {},
} ) {
	const [ selected, setSelected ] = useState( 'meta' );
	const [ collision, setCollision ] = useState( '' );
	const suggestions = useId();
	const mapping = value[ selected ] || {
		enabled: false,
		name: 'CustomEvent',
		params: {},
		server: false,
	};
	const title = providers[ selected ].name;
	const change = ( patch ) =>
		onChange( { ...value, [ selected ]: { ...mapping, ...patch } } );
	const parameter = ( index, key, next ) => {
		const pairs = Object.entries( mapping.params );
		if ( pairs.some( ( [ other ], i ) => i !== index && other === key ) ) {
			setCollision(
				__(
					'That parameter name is already used. Choose another name.',
					'pixelpair'
				)
			);
			return;
		}
		setCollision( '' );
		pairs[ index ] = [ key, next ];
		change( { params: Object.fromEntries( pairs ) } );
	};
	const filteredParams = ( platform, params ) =>
		Object.fromEntries(
			Object.entries( params || {} ).filter( ( [ key ] ) => {
				if (
					Object.hasOwn( contextLabels, key ) &&
					! settings.context_parameters?.includes( key )
				) {
					return false;
				}
				return (
					platform !== 'meta' ||
					! settings.meta_sensitive_data ||
					[
						'value',
						'currency',
						'num_items',
						'percent_scrolled',
						'seconds',
					].includes( key )
				);
			} )
		);
	const payloads = Object.fromEntries(
		Object.keys( providers )
			.filter( ( key ) => value[ key ] )
			.map( ( key ) => [ key, value[ key ] ] )
			.filter( ( [ , m ] ) => m.enabled )
			.map( ( [ key, m ] ) => [
				providers[ key ].name,
				key === 'meta'
					? `fbq('${ standardMetaEvents.includes( m.name ) ? 'track' : 'trackCustom' }', ${ JSON.stringify( m.name ) }, ${ JSON.stringify( filteredParams( key, m.params ), null, 2 ) }, { eventID });`
					: {
							event:
								key === 'gtm'
									? `pixelpair_${ m.name }`
									: m.name,
							parameters: filteredParams( key, m.params ),
							...( providers[ key ].server
								? { server: m.server }
								: {} ),
						},
			] )
	);
	return (
		<div className="pixelpair-mapping">
			<div
				className="pixelpair-actions"
				role="group"
				aria-label={ __( 'Event connections', 'pixelpair' ) }
			>
				{ Object.entries( providers ).map( ( [ id, provider ] ) => (
					<Button
						key={ id }
						variant="tertiary"
						aria-pressed={ id === selected }
						onClick={ () => {
							setSelected( id );
							setCollision( '' );
						} }
					>
						{ provider.name }
					</Button>
				) ) }
			</div>
			<div className="pixelpair-fields">
				<CheckField
					label={ sprintf(
						/* translators: %1$s: connection name. */ __(
							'Send to %1$s',
							'pixelpair'
						),
						title
					) }
					checked={ mapping.enabled }
					disabled={ pageView && selected !== 'tiktok' }
					onChange={ ( enabled ) => change( { enabled } ) }
					help={ __(
						'Events send only when this connection is enabled.',
						'pixelpair'
					) }
				/>
				<TextField
					label={ sprintf(
						/* translators: %1$s: connection name. */ __(
							'%1$s event name',
							'pixelpair'
						),
						title
					) }
					value={ mapping.name }
					onChange={ ( name ) => change( { name } ) }
					list={ suggestions }
					error={
						! validEventName( mapping.name )
							? __(
									'Start with a letter; use up to 40 letters, numbers or underscores.',
									'pixelpair'
								)
							: ''
					}
					help={ __(
						'Choose a standard event or enter your own name.',
						'pixelpair'
					) }
				/>
				<datalist id={ suggestions }>
					{ {
						meta: standardMetaEvents,
						ga4: [
							'generate_lead',
							'page_view',
							'search',
							'sign_up',
							'login',
							'purchase',
						],
						tiktok: [
							'Contact',
							'SubmitForm',
							'CompleteRegistration',
							'ViewContent',
							'AddToCart',
							'Purchase',
						],
						gtm: [],
					}[ selected ].map( ( name ) => (
						<option key={ name } value={ name } />
					) ) }
				</datalist>
				{ providers[ selected ].server && (
					<CheckField
						label={ __(
							'Send events from your server too',
							'pixelpair'
						) }
						checked={ mapping.server }
						onChange={ ( server ) => change( { server } ) }
						help={ __(
							'Requires server events and an access token in Connections.',
							'pixelpair'
						) }
					/>
				) }
				{ Object.entries( mapping.params ).map(
					( [ key, val ], index ) => (
						<div
							className="pixelpair-mapping-parameter"
							key={ index }
						>
							<TextField
								label={ __( 'Parameter name', 'pixelpair' ) }
								value={ key }
								onChange={ ( next ) =>
									parameter( index, next, val )
								}
								error={
									collision ||
									( ! validParameterName( key )
										? __(
												'Choose a unique, non-reserved name starting with a letter.',
												'pixelpair'
											)
										: '' )
								}
							/>
							<SelectField
								label={ __( 'Value type', 'pixelpair' ) }
								value={ typeof val }
								options={ [
									{
										value: 'string',
										label: __(
											'Text or token',
											'pixelpair'
										),
									},
									{
										value: 'number',
										label: __( 'Number', 'pixelpair' ),
									},
									{
										value: 'boolean',
										label: __(
											'True or false',
											'pixelpair'
										),
									},
								] }
								onChange={ ( type ) =>
									parameter(
										index,
										key,
										{
											string: '',
											number: 0,
											boolean: false,
										}[ type ]
									)
								}
							/>
							{ typeof val === 'boolean' ? (
								<CheckField
									label={ __( 'Value', 'pixelpair' ) }
									checked={ val }
									onChange={ ( next ) =>
										parameter( index, key, next )
									}
								/>
							) : (
								<TextField
									label={ __( 'Value', 'pixelpair' ) }
									value={ val }
									type={
										typeof val === 'number'
											? 'number'
											: 'text'
									}
									onChange={ ( next ) =>
										parameter(
											index,
											key,
											typeof val === 'number'
												? Number( next )
												: next
										)
									}
									error={
										! validParameterValue( val )
											? __(
													'Shorten this value or use a supported token.',
													'pixelpair'
												)
											: ''
									}
								/>
							) }
							<Button
								variant="tertiary"
								onClick={ () => {
									setCollision( '' );
									change( {
										params: Object.fromEntries(
											Object.entries(
												mapping.params
											).filter( ( _, i ) => i !== index )
										),
									} );
								} }
							>
								{ __( 'Remove parameter', 'pixelpair' ) }
							</Button>
						</div>
					)
				) }
				<div>
					<Button
						disabled={ Object.keys( mapping.params ).length >= 25 }
						onClick={ () => {
							let n = 1;
							while (
								Object.hasOwn(
									mapping.params,
									`parameter_${ n }`
								)
							) {
								n++;
							}
							change( {
								params: {
									...mapping.params,
									[ `parameter_${ n }` ]: '',
								},
							} );
						} }
					>
						{ __( 'Add a parameter', 'pixelpair' ) }
					</Button>
				</div>
				{ Object.keys( mapping.params ).length > 0 && (
					<details className="pixelpair-inline-disclosure">
						<summary>
							{ __( 'Available tokens', 'pixelpair' ) }
						</summary>
						<p className="pixelpair-help">
							{
								'{post_title}, {post_id}, {post_type}, {page_url}, {woo_cart_total}, {url_param:name}'
							}
						</p>
					</details>
				) }
			</div>
			<PayloadPreview payloads={ payloads } />
			<p className="pixelpair-help">
				{ __(
					'Preview applies saved filters; visitor context, event IDs and consent apply when events send.',
					'pixelpair'
				) }
			</p>
		</div>
	);
}
