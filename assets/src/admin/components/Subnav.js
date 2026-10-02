/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
export default function Subnav( { label, items, current, navigate } ) {
	return (
		<nav className="pixelpair-subnav" aria-label={ label }>
			{ items.map( ( [ id, title ] ) => (
				<a
					key={ id }
					href={ `#/${ id }` }
					aria-current={ current === id ? 'page' : undefined }
					onClick={ ( event ) => {
						if (
							! event.ctrlKey &&
							! event.metaKey &&
							! event.shiftKey
						) {
							event.preventDefault();
							navigate( id );
						}
					} }
				>
					{ title }
				</a>
			) ) }
		</nav>
	);
}
