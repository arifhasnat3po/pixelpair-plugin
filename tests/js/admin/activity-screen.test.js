import { render, screen, fireEvent } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Logs from '../../../assets/src/admin/screens/Logs';
jest.mock( '@wordpress/api-fetch', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );
beforeEach( () => apiFetch.mockReset() );
test( 'failed Activity loads offer Retry and redacted details do not imply browser matching', async () => {
	apiFetch
		.mockRejectedValueOnce(
			new Error( 'Activity unavailable. Try again.' )
		)
		.mockResolvedValue( {
			items: [
				{
					id: 1,
					created_at: 1700000000,
					platform: 'meta',
					event_name: 'Purchase',
					status: 'sent',
					response_code: 200,
					details: JSON.stringify( {
						request: { user_data: '[redacted]' },
						response: { events_received: 1 },
					} ),
				},
			],
			total: 1,
			page: 1,
		} );
	render(
		<Logs
			settings={ { logging_enabled: true } }
			save={ jest.fn() }
			navigate={ jest.fn() }
		/>
	);
	fireEvent.click( await screen.findByRole( 'button', { name: 'Retry' } ) );
	await screen.findByText( 'Purchase' );
	expect(
		screen.queryByText( 'Matched', { exact: true } )
	).not.toBeInTheDocument();
	fireEvent.click( screen.getByText( 'Show details', { exact: true } ) );
	expect( screen.getByText( /"user_data": "\[redacted\]"/ ) ).toBeVisible();
} );
