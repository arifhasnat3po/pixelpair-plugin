import { __ } from '@wordpress/i18n';
const bytes = ( value ) => new TextEncoder().encode( value ).length;
export const triggerChoices = [
	[ 'click', __( 'someone clicks', 'pixelpair' ) ],
	[ 'url', __( 'someone visits a matching URL', 'pixelpair' ) ],
	[ 'home', __( 'someone visits the home page', 'pixelpair' ) ],
	[ 'scroll', __( 'the page has scrolled to', 'pixelpair' ) ],
	[ 'time', __( 'the page has been viewed for', 'pixelpair' ) ],
	[ 'link', __( 'someone follows a matching link', 'pixelpair' ) ],
	[ 'mouseover', __( 'someone moves the pointer over', 'pixelpair' ) ],
	[ 'visible', __( 'an element becomes visible', 'pixelpair' ) ],
	[ 'page_count', __( 'someone has viewed this many pages', 'pixelpair' ) ],
	[ 'post_type', __( 'someone visits a content type', 'pixelpair' ) ],
	[ 'posts', __( 'someone visits selected pages', 'pixelpair' ) ],
	[
		'terms',
		__( 'someone visits content in a category or tag', 'pixelpair' ),
	],
	[ 'url_param', __( 'the URL has a parameter', 'pixelpair' ) ],
];
export const conditionChoices = [
	[ 'device', __( 'Device is', 'pixelpair' ) ],
	[ 'role', __( 'User role is', 'pixelpair' ) ],
	[ 'url_contains', __( 'URL contains', 'pixelpair' ) ],
	[ 'url_not_contains', __( 'URL does not contain', 'pixelpair' ) ],
	[ 'utm_source', __( 'Campaign source is', 'pixelpair' ) ],
	[ 'utm_medium', __( 'Campaign medium is', 'pixelpair' ) ],
	[ 'utm_campaign', __( 'Campaign name is', 'pixelpair' ) ],
	[ 'referrer_domain', __( 'Referring domain is', 'pixelpair' ) ],
];
export const choices = ( items ) =>
	items.map( ( [ value, label ] ) => ( { value, label } ) );
export const numericTriggers = [ 'scroll', 'time', 'page_count' ];
export const delayedTriggers = [
	'url',
	'home',
	'post_type',
	'posts',
	'terms',
	'url_param',
];
export const freshTrigger = ( type ) => ( {
	type,
	...( type === 'home'
		? {}
		: { value: numericTriggers.includes( type ) ? 1 : '' } ),
	...( [ 'url', 'link' ].includes( type ) ? { operator: 'contains' } : {} ),
	...( type === 'url_param' ? { operator: 'present', key: '' } : {} ),
} );
export function validSelector( value ) {
	return (
		!! value.trim() &&
		bytes( value ) <= 256 &&
		value.split( ',' ).every( ( group ) =>
			group
				.trim()
				.split( /\s*>\s*|\s+/ )
				.every(
					( part ) =>
						part !== '' &&
						/^(?:[a-zA-Z][a-zA-Z0-9_-]*|\*)?(?:[.#][a-zA-Z_][a-zA-Z0-9_-]*)*$/.test(
							part
						)
				)
		)
	);
}
export function validRegex( value ) {
	if (
		! value ||
		bytes( value ) > 256 ||
		( value.match( /\.\*/g ) || [] ).length > 1
	) {
		return false;
	}
	const literal = value.replace( /\.\*|\\[./?&=\-]/g, '' );
	if ( /[\\()[\]{}+?*|]/.test( literal ) ) {
		return false;
	}
	try {
		new RegExp( value );
		return true;
	} catch {
		return false;
	}
}
export function triggerError( row ) {
	if (
		row.delay !== undefined &&
		( ! Number.isInteger( row.delay ) || row.delay < 0 || row.delay > 3600 )
	) {
		return __( 'Use a delay between 0 and 3600 seconds.', 'pixelpair' );
	}
	if ( row.type === 'home' ) {
		return '';
	}
	if ( numericTriggers.includes( row.type ) ) {
		return Number.isInteger( row.value ) &&
			row.value >= 1 &&
			row.value <= ( row.type === 'scroll' ? 100 : 3600 )
			? ''
			: __( 'Enter a whole number in the allowed range.', 'pixelpair' );
	}
	if ( typeof row.value !== 'string' || bytes( row.value ) > 512 ) {
		return __( 'Shorten this value and try again.', 'pixelpair' );
	}
	if ( [ 'click', 'mouseover', 'visible' ].includes( row.type ) ) {
		return validSelector( row.value )
			? ''
			: __(
					'Use a tag, class or ID selector; unsupported selector syntax cannot be saved.',
					'pixelpair'
				);
	}
	if ( [ 'url', 'link' ].includes( row.type ) ) {
		if ( ! row.value.trim() ) {
			return __( 'Enter the URL or pattern to match.', 'pixelpair' );
		}
		return row.operator === 'regex' && ! validRegex( row.value )
			? __(
					'Use literals, anchors and at most one .* wildcard.',
					'pixelpair'
				)
			: '';
	}
	if ( row.type === 'post_type' ) {
		return /^[a-z0-9_-]{1,32}$/.test( row.value )
			? ''
			: __(
					'Enter a content type slug, such as post or page.',
					'pixelpair'
				);
	}
	if ( row.type === 'posts' ) {
		return /^[1-9][0-9]*(?:,[1-9][0-9]*){0,49}$/.test( row.value )
			? ''
			: __(
					'Enter up to 50 positive page IDs, separated by commas without spaces.',
					'pixelpair'
				);
	}
	if ( row.type === 'terms' ) {
		return /^[a-z0-9_-]{1,32}:[1-9][0-9]*$/.test( row.value )
			? ''
			: __( 'Use taxonomy:id, such as category:12.', 'pixelpair' );
	}
	if ( row.type === 'url_param' ) {
		return /^[a-zA-Z0-9_-]{1,64}$/.test( row.key )
			? ''
			: __(
					'Enter a parameter name using letters, numbers, underscores or hyphens.',
					'pixelpair'
				);
	}
	return __( 'Choose a supported action.', 'pixelpair' );
}
export function conditionError( row ) {
	if (
		typeof row.value !== 'string' ||
		! row.value ||
		bytes( row.value ) > 256
	) {
		return __( 'Enter a short value to match.', 'pixelpair' );
	}
	if (
		row.type === 'device' &&
		! [ 'desktop', 'mobile', 'tablet' ].includes( row.value )
	) {
		return __( 'Choose a device.', 'pixelpair' );
	}
	if ( row.type === 'role' && ! /^[a-zA-Z0-9_-]{1,64}$/.test( row.value ) ) {
		return __( 'Choose a role or enter its slug.', 'pixelpair' );
	}
	if (
		row.type === 'referrer_domain' &&
		! /^[a-zA-Z0-9.-]{1,253}$/.test( row.value )
	) {
		return __( 'Enter a domain without a protocol or path.', 'pixelpair' );
	}
	return '';
}
