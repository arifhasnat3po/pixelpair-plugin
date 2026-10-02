/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Subnav from './Subnav';
export default function EventTabs( { current, navigate } ) {
	return (
		<Subnav
			label={ __( 'Event types', 'pixelpair' ) }
			current={ current }
			navigate={ navigate }
			items={ [
				[ 'events', __( 'Automatic', 'pixelpair' ) ],
				[ 'events/custom', __( 'Custom', 'pixelpair' ) ],
			] }
		/>
	);
}
