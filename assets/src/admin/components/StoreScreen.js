/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Page, Section, Button, SaveBar, Feedback, StatusBadge } from './ui';
import { CheckField, TextField, SelectField } from './ui/fields';
import Subnav from './Subnav';
import { useDraft } from '../data/useDraft';
export const storeNames = {
	woocommerce: __( 'WooCommerce', 'pixelpair' ),
	edd: __( 'Easy Digital Downloads', 'pixelpair' ),
};
export function StoreTabs( { provider, navigate } ) {
	return (
		<Subnav
			label={ __( 'Store providers', 'pixelpair' ) }
			current={ `store/${ provider }` }
			navigate={ navigate }
			items={ Object.entries( storeNames )
				.filter( ( [ key ] ) => window.pixelpairAdmin?.stores?.[ key ] )
				.map( ( [ key, label ] ) => [ `store/${ key }`, label ] ) }
		/>
	);
}
const eventOptions = {
	view_item: [
		__( 'Product views', 'pixelpair' ),
		__( 'Someone opens a product page.', 'pixelpair' ),
	],
	view_item_list: [
		__( 'Product lists', 'pixelpair' ),
		__( 'Someone sees a list of products.', 'pixelpair' ),
	],
	add_to_cart: [
		__( 'Add to cart', 'pixelpair' ),
		__( 'Your store confirms an item was added.', 'pixelpair' ),
	],
	view_cart: [
		__( 'Cart views', 'pixelpair' ),
		__( 'Someone opens their cart.', 'pixelpair' ),
	],
	begin_checkout: [
		__( 'Checkout starts', 'pixelpair' ),
		__( 'Someone begins checkout.', 'pixelpair' ),
	],
	add_payment_info: [
		__( 'Payment selection', 'pixelpair' ),
		__( 'Someone chooses how to pay.', 'pixelpair' ),
	],
	add_shipping_info: [
		__( 'Shipping selection', 'pixelpair' ),
		__( 'Someone chooses a shipping method.', 'pixelpair' ),
	],
	purchase: [
		__( 'Purchases', 'pixelpair' ),
		__( 'A paid order is confirmed.', 'pixelpair' ),
	],
};
export default function StoreScreen( {
	provider,
	settings,
	save,
	error,
	navigate,
} ) {
	const { events, ...fields } = settings[ provider ];
	const source = {
		...fields,
		...Object.fromEntries(
			Object.entries( events ).map( ( [ key, value ] ) => [
				`event_${ key }`,
				value,
			] )
		),
	};
	const write = ( patch ) =>
		save( ( latest ) => {
			const entries = Object.entries( patch );
			const eventPatch = Object.fromEntries(
				entries
					.filter( ( [ key ] ) => key.startsWith( 'event_' ) )
					.map( ( [ key, value ] ) => [ key.slice( 6 ), value ] )
			);
			return {
				[ provider ]: {
					...latest[ provider ],
					...Object.fromEntries(
						entries.filter(
							( [ key ] ) => ! key.startsWith( 'event_' )
						)
					),
					events: { ...latest[ provider ].events, ...eventPatch },
				},
			};
		} );
	const draft = useDraft( source, Object.keys( source ), write );
	const value = draft.values;
	const connected = [
		'meta_enabled',
		'ga4_enabled',
		'gtm_enabled',
		'tiktok_enabled',
	].some( ( key ) => settings[ key ] );
	const validPart = ( part ) => /^[A-Za-z0-9_-]{0,64}$/.test( part );
	const validPercent =
		Number.isFinite( value.non_purchase_percent ) &&
		value.non_purchase_percent >= 0 &&
		value.non_purchase_percent <= 10000;
	const validLimit =
		Number.isInteger( value.list_limit ) &&
		value.list_limit >= 0 &&
		value.list_limit <= 200;
	const valid =
		validPart( value.id_prefix ) &&
		validPart( value.id_suffix ) &&
		validPercent &&
		validLimit;
	const checks = [
		[
			'parent_ids',
			__( 'Use parent product IDs', 'pixelpair' ),
			provider === 'edd'
				? __(
						'Use the download ID without its variable-price suffix.',
						'pixelpair'
					)
				: __(
						'Match variations to their parent product in your catalog.',
						'pixelpair'
					),
		],
		[
			'include_tax',
			__( 'Include tax', 'pixelpair' ),
			__(
				'Include tax in event values sent to connections.',
				'pixelpair'
			),
		],
		[
			'include_shipping',
			__( 'Include shipping', 'pixelpair' ),
			__(
				'Include shipping in the purchase value sent to connections.',
				'pixelpair'
			),
		],
		[
			'include_fees',
			__( 'Include fees', 'pixelpair' ),
			__( 'Include store fees in the purchase value.', 'pixelpair' ),
		],
		[
			'attribution',
			__( 'Save order attribution', 'pixelpair' ),
			__(
				'Keep consented campaign and referral details with the order.',
				'pixelpair'
			),
		],
		[
			'hide_attribution',
			__( 'Hide attribution in order details', 'pixelpair' ),
			__(
				'Keep saved attribution out of the order administration screen.',
				'pixelpair'
			),
		],
		[
			'safety_net',
			__( 'Send purchases when the receipt page is missed', 'pixelpair' ),
			__(
				'Requires server events, consented matching details and a confirmed paid order.',
				'pixelpair'
			),
		],
		[
			'renewals',
			__( 'Track subscription renewals', 'pixelpair' ),
			__(
				'Include supported recurring payments as purchases.',
				'pixelpair'
			),
		],
	];
	return (
		<Page
			title={ storeNames[ provider ] }
			description={ __(
				'Send verified store actions to your enabled connections.',
				'pixelpair'
			) }
			status={
				<StatusBadge
					status={ settings[ provider ].enabled ? 'info' : 'neutral' }
				>
					{ settings[ provider ].enabled
						? __( 'Store tracking configured', 'pixelpair' )
						: __( 'Store tracking is off', 'pixelpair' ) }
				</StatusBadge>
			}
		>
			<StoreTabs provider={ provider } navigate={ navigate } />
			{ ! connected && (
				<Feedback
					status="info"
					message={ __(
						'Set up a connection before sending store events.',
						'pixelpair'
					) }
					action={
						<Button onClick={ () => navigate( 'connections' ) }>
							{ __( 'Open Connections', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			{ error && <Feedback error message={ error } /> }
			{ draft.message && <Feedback message={ draft.message } /> }
			<form
				onSubmit={ ( event ) => {
					event.preventDefault();
					if ( valid ) {
						draft.submit();
					}
				} }
			>
				<fieldset
					className="pixelpair-fieldset"
					disabled={ draft.busy }
				>
					<Section title={ __( 'Store tracking', 'pixelpair' ) }>
						<CheckField
							label={ __( 'Track store events', 'pixelpair' ) }
							checked={ value.enabled }
							onChange={ ( next ) =>
								draft.change( 'enabled', next )
							}
							help={ __(
								'Use your consent and exclusion rules for every store event.',
								'pixelpair'
							) }
						/>
						<SelectField
							label={ __( 'Product IDs', 'pixelpair' ) }
							value={ value.content_id }
							onChange={ ( next ) =>
								draft.change( 'content_id', next )
							}
							help={ __(
								'Choose the identifier that matches your advertising catalog.',
								'pixelpair'
							) }
							options={ [
								{
									value: 'id',
									label: __( 'Product ID', 'pixelpair' ),
								},
								{
									value: 'sku',
									label: __(
										'SKU, with product ID as fallback',
										'pixelpair'
									),
								},
							] }
						/>
					</Section>
					<Section
						title={ __( 'Events', 'pixelpair' ) }
						description={ __(
							'Choose the store actions to track, then save your changes.',
							'pixelpair'
						) }
					>
						<div className="pixelpair-store-events">
							{ Object.entries( eventOptions )
								.filter(
									( [ key ] ) =>
										provider !== 'edd' ||
										key !== 'add_shipping_info'
								)
								.map( ( [ key, [ label, help ] ] ) => (
									<CheckField
										key={ key }
										label={ label }
										help={ help }
										checked={ value[ `event_${ key }` ] }
										onChange={ ( next ) =>
											draft.change(
												`event_${ key }`,
												next
											)
										}
									/>
								) ) }
						</div>
					</Section>
					<Section advanced>
						<TextField
							label={ __( 'Product ID prefix', 'pixelpair' ) }
							help={ __(
								'Add text before every product ID to match your catalog.',
								'pixelpair'
							) }
							value={ value.id_prefix }
							onChange={ ( next ) =>
								draft.change( 'id_prefix', next )
							}
							error={
								! validPart( value.id_prefix )
									? __(
											'Use up to 64 letters, numbers, underscores or hyphens.',
											'pixelpair'
										)
									: ''
							}
						/>
						<TextField
							label={ __( 'Product ID suffix', 'pixelpair' ) }
							help={ __(
								'Add text after every product ID to match your catalog.',
								'pixelpair'
							) }
							value={ value.id_suffix }
							onChange={ ( next ) =>
								draft.change( 'id_suffix', next )
							}
							error={
								! validPart( value.id_suffix )
									? __(
											'Use up to 64 letters, numbers, underscores or hyphens.',
											'pixelpair'
										)
									: ''
							}
						/>
						{ checks
							.filter(
								( [ key ] ) =>
									provider !== 'edd' ||
									key !== 'include_shipping'
							)
							.map( ( [ key, label, help ] ) => (
								<CheckField
									key={ key }
									label={ label }
									help={ help }
									checked={ value[ key ] }
									onChange={ ( next ) =>
										draft.change( key, next )
									}
								/>
							) ) }
						<TextField
							label={ __(
								'Non-purchase value percentage',
								'pixelpair'
							) }
							help={ __(
								'Scale values for browsing and cart events; purchases keep their actual totals.',
								'pixelpair'
							) }
							type="number"
							min="0"
							max="10000"
							step="any"
							value={ value.non_purchase_percent }
							onChange={ ( next ) =>
								draft.change(
									'non_purchase_percent',
									Number( next )
								)
							}
							error={
								! validPercent
									? __(
											'Enter a percentage between 0 and 10000.',
											'pixelpair'
										)
									: ''
							}
						/>
						<TextField
							label={ __( 'Product-list limit', 'pixelpair' ) }
							help={ __(
								'Limit products per list event; use 0 to disable list events.',
								'pixelpair'
							) }
							type="number"
							min="0"
							max="200"
							value={ value.list_limit }
							onChange={ ( next ) =>
								draft.change( 'list_limit', Number( next ) )
							}
							error={
								! validLimit
									? __(
											'Enter a whole number between 0 and 200.',
											'pixelpair'
										)
									: ''
							}
						/>
						<SelectField
							label={ __(
								'Add-to-cart confirmation',
								'pixelpair'
							) }
							help={ __(
								'Both require a successful cart update; store confirmation also supports server delivery.',
								'pixelpair'
							) }
							value={ value.add_to_cart_source }
							onChange={ ( next ) =>
								draft.change( 'add_to_cart_source', next )
							}
							options={ [
								{
									value: 'hook',
									label: __(
										'Store confirmation',
										'pixelpair'
									),
								},
								{
									value: 'button',
									label: __(
										'Browser confirmation',
										'pixelpair'
									),
								},
							] }
						/>
					</Section>
				</fieldset>
				<SaveBar
					dirty={ draft.dirty }
					busy={ draft.busy }
					disabled={ ! valid }
					onDiscard={ draft.discard }
				/>
			</form>
		</Page>
	);
}
