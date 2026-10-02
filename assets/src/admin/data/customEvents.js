import { __, sprintf, _n } from '@wordpress/i18n';
export function triggerSummary( rule ) {
	const trigger = rule.triggers[ 0 ];
	const descriptions = {
		click: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Clicks %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		mouseover: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Moves the pointer over %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		visible: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Sees %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		url: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Visits a URL matching %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		link: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Follows a link matching %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		post_type: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Visits a %1$s page',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		posts: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Visits pages %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		terms: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Visits content in %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		scroll: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Scrolls to %1$s%%',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		time: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Views a page for %1$s seconds',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		page_count: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Views %1$s pages',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
		url_param: () =>
			sprintf(
				/* translators: %1$s: configured selector, URL, amount or parameter. */ __(
					'Visits with URL parameter %1$s',
					'pixelpair'
				),
				trigger.type === 'url_param' ? trigger.key : trigger.value
			),
	};
	if ( rule.triggers.length > 1 ) {
		return sprintf(
			/* translators: %1$d: number of triggers. */ _n(
				'%1$d trigger',
				'%1$d triggers',
				rule.triggers.length,
				'pixelpair'
			),
			rule.triggers.length
		);
	}
	if ( trigger.type === 'home' ) {
		return __( 'Visits the home page', 'pixelpair' );
	}
	return (
		descriptions[ trigger.type ]?.() || __( 'Other trigger', 'pixelpair' )
	);
}
export const newRule = () => ( {
	name: '',
	status: 'active',
	triggers: [ { type: 'click', value: '' } ],
	conditions: [],
	once_per_session: false,
	platforms: Object.fromEntries(
		[ 'meta', 'ga4', 'gtm', 'tiktok' ].map( ( platform ) => [
			platform,
			{
				enabled: platform === 'meta',
				name: platform === 'meta' ? 'Contact' : 'generate_lead',
				params: {},
				server: platform === 'meta',
			},
		] )
	),
} );
