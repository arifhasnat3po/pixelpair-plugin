/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default function Brand() {
	return (
		<img
			className="pixelpair-brand"
			src={ window.pixelpairAdmin?.logoUrl }
			alt={ __( 'PixelPair', 'pixelpair' ) }
			width="144"
			height="32"
		/>
	);
}
