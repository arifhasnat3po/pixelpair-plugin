import { render, screen, fireEvent } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import AI from '../../../assets/src/admin/screens/AI';
jest.mock( '@wordpress/api-fetch', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );
beforeEach( () => apiFetch.mockReset() );
test( 'AI access recovers a failed read and explains a denied clipboard without changing settings', async () => {
	apiFetch
		.mockRejectedValueOnce( new Error( 'Access status unavailable.' ) )
		.mockResolvedValue( {
			abilities: true,
			adapter: true,
			https: true,
			endpoint: 'https://example.test/wp-json/pixelpair/mcp',
			site_id: 1,
			profile_url: '/wp-admin/profile.php',
		} );
	Object.defineProperty( navigator, 'clipboard', {
		configurable: true,
		value: {
			writeText: jest.fn().mockRejectedValue( new Error( 'Denied' ) ),
		},
	} );
	render( <AI navigate={ jest.fn() } /> );
	fireEvent.click( await screen.findByRole( 'button', { name: 'Retry' } ) );
	fireEvent.click(
		await screen.findByRole( 'button', { name: 'Copy connection details' } )
	);
	await screen.findByText(
		'Copy was blocked. Select and copy the endpoint and site ID below.'
	);
	expect(
		apiFetch.mock.calls.every(
			( [ request ] ) => ! request.method || request.method === 'GET'
		)
	).toBe( true );
} );
