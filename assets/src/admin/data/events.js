import { __ } from '@wordpress/i18n';
export const eventLabels = {
	page_view: __( 'Page views', 'pixelpair' ),
	search: __( 'Searches', 'pixelpair' ),
	not_found: __( 'Missing pages', 'pixelpair' ),
	form_submit: __( 'Form submissions', 'pixelpair' ),
	sign_up: __( 'Account registrations', 'pixelpair' ),
	login: __( 'Sign-ins', 'pixelpair' ),
	comment: __( 'Comments', 'pixelpair' ),
	file_download: __( 'File downloads', 'pixelpair' ),
	scroll_depth: __( 'Scroll depth', 'pixelpair' ),
	time_on_page: __( 'Time on page', 'pixelpair' ),
	outbound_link: __( 'Outbound links', 'pixelpair' ),
};
export const eventDescriptions = {
	page_view: __(
		'Tracked by each enabled connection when a visitor opens a page.',
		'pixelpair'
	),
	search: __( 'Someone searches your site.', 'pixelpair' ),
	not_found: __( 'Someone visits a page that cannot be found.', 'pixelpair' ),
	form_submit: __( 'Someone submits a form on your site.', 'pixelpair' ),
	sign_up: __( 'Someone creates an account.', 'pixelpair' ),
	login: __( 'Someone signs in to an existing account.', 'pixelpair' ),
	comment: __( 'Someone posts a comment.', 'pixelpair' ),
	file_download: __(
		'Someone follows a link to a downloadable file.',
		'pixelpair'
	),
	scroll_depth: __(
		'Someone scrolls through a chosen percentage of a page.',
		'pixelpair'
	),
	time_on_page: __(
		'Someone spends a chosen amount of visible time on a page.',
		'pixelpair'
	),
	outbound_link: __(
		'Someone follows a link to another website.',
		'pixelpair'
	),
};
export const contextLabels = {
	page_title: __( 'Page title', 'pixelpair' ),
	post_type: __( 'Post type', 'pixelpair' ),
	post_id: __( 'Post ID', 'pixelpair' ),
	categories: __( 'Categories', 'pixelpair' ),
	tags: __( 'Tags', 'pixelpair' ),
	landing_page: __( 'Landing page', 'pixelpair' ),
	traffic_source: __( 'Traffic source', 'pixelpair' ),
	utm_source: __( 'Campaign source', 'pixelpair' ),
	utm_medium: __( 'Campaign medium', 'pixelpair' ),
	utm_campaign: __( 'Campaign name', 'pixelpair' ),
	utm_term: __( 'Campaign term', 'pixelpair' ),
	utm_content: __( 'Campaign content', 'pixelpair' ),
};
export const validEventName = ( value ) =>
	/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test( value );
const reserved = [
	'constructor',
	'prototype',
	'__proto__',
	'event_id',
	'send_to',
	'user_data',
	'email',
	'phone',
	'em',
	'ph',
];
export const validParameterName = ( value ) =>
	validEventName( value ) && ! reserved.includes( value );
export function validParameterValue( value ) {
	if ( typeof value === 'number' ) {
		return Number.isFinite( value );
	}
	if ( typeof value === 'boolean' ) {
		return true;
	}
	if (
		typeof value !== 'string' ||
		new TextEncoder().encode( value ).length > 512
	) {
		return false;
	}
	return ! /[{}]/.test(
		value.replace(
			/\{(post_title|post_id|post_type|page_url|woo_cart_total|url_param:[a-zA-Z0-9_-]{1,64})\}/g,
			''
		)
	);
}
export const validMappings = ( value ) =>
	Object.values( value ).every(
		( mapping ) =>
			validEventName( mapping.name ) &&
			Object.entries( mapping.params ).length <= 25 &&
			Object.entries( mapping.params ).every(
				( [ key, val ] ) =>
					validParameterName( key ) && validParameterValue( val )
			)
	);
export const listValues = ( value ) =>
	String( value )
		.split( ',' )
		.map( ( v ) => v.trim() )
		.filter( Boolean );
export const validThresholds = ( value, max ) =>
	listValues( value ).length <= 20 &&
	listValues( value ).every(
		( v ) => /^\d+$/.test( v ) && Number( v ) >= 1 && Number( v ) <= max
	);
export const standardMetaEvents = [
	'PageView',
	'Search',
	'Lead',
	'CompleteRegistration',
	'ViewContent',
	'AddToCart',
	'InitiateCheckout',
	'AddPaymentInfo',
	'Purchase',
	'Contact',
	'Subscribe',
	'SubmitApplication',
	'Schedule',
	'Donate',
	'StartTrial',
	'AddToWishlist',
	'CustomizeProduct',
	'FindLocation',
];
