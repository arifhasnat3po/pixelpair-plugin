/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { speak } from '@wordpress/a11y';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Feedback } from './ui';
import { providers } from '../data/connections';

export default function TestModeNotice( { platform, onChange } ) {
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );
	const turnOff = async () => {
		setBusy( true );
		setError( '' );
		try {
			await apiFetch( {
				path: `/pixelpair/v1/${ platform }`,
				method: 'POST',
				data: { test_code: '' },
			} );
			speak( __( 'Test mode turned off', 'pixelpair' ) );
			await onChange();
		} catch ( problem ) {
			setError( problem.message );
		} finally {
			setBusy( false );
		}
	};
	return (
		<Feedback
			status="warning"
			error={ !! error }
			message={
				error ||
				sprintf(
					/* translators: %1$s: connection name. */ __(
						'Test mode is on for %1$s.',
						'pixelpair'
					),
					providers[ platform ].name
				)
			}
			action={
				<Button
					busy={ busy }
					busyLabel={ __( 'Turning off…', 'pixelpair' ) }
					onClick={ turnOff }
				>
					{ __( 'Turn off test mode', 'pixelpair' ) }
				</Button>
			}
		/>
	);
}
