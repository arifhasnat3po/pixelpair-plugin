/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import ServerConnection from '../components/ServerConnection';

const advanced = [
	{
		key: 'tiktok_advanced_matching',
		label: __( 'Advanced matching', 'pixelpair' ),
		help: __(
			'Send consented, hashed profile and checkout details to improve event matching.',
			'pixelpair'
		),
	},
];
export default function TikTok( props ) {
	return (
		<ServerConnection
			platform="tiktok"
			advanced={ advanced }
			{ ...props }
		/>
	);
}
