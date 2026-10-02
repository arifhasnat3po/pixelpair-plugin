/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import ServerConnection from '../components/ServerConnection';

const advanced = [
	{
		key: 'meta_advanced_matching',
		label: __( 'Advanced matching', 'pixelpair' ),
		help: __(
			'Use consented, hashed profile details to improve event matching.',
			'pixelpair'
		),
	},
	{
		key: 'meta_ldu',
		label: __( 'Limited Data Use', 'pixelpair' ),
		help: __(
			'Ask Meta to limit processing of events from applicable visitors.',
			'pixelpair'
		),
	},
	{
		key: 'meta_sensitive_data',
		label: __( 'Remove sensitive context parameters', 'pixelpair' ),
		help: __(
			'Removes server context; the browser pixel can still send its page URL.',
			'pixelpair'
		),
	},
];
export default function Meta( props ) {
	return (
		<ServerConnection platform="meta" advanced={ advanced } { ...props } />
	);
}
