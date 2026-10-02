/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, StatusBadge } from './ui';
import { providers, connectionStatus } from '../data/connections';

export default function ConnectionList( { platforms, navigate } ) {
	return (
		<ul className="pixelpair-connections">
			{ Object.entries( providers ).map( ( [ id, provider ] ) => {
				const status = connectionStatus( platforms[ id ] );
				return (
					<li key={ id }>
						<strong>{ provider.name }</strong>
						<StatusBadge status={ status.status }>
							{ status.text }
						</StatusBadge>
						<Button
							onClick={ () => navigate( `connections/${ id }` ) }
							aria-label={ sprintf(
								/* translators: %1$s: action, %2$s: connection. */ __(
									'%1$s %2$s',
									'pixelpair'
								),
								status.action,
								provider.name
							) }
						>
							{ status.action }
						</Button>
					</li>
				);
			} ) }
		</ul>
	);
}
