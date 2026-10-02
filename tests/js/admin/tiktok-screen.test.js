import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';
jest.mock( '@wordpress/api-fetch', () => jest.fn() );
test( 'TikTok saves its snippet and token without changing Meta settings or credentials', async () => {
	window.history.replaceState( null, '', '#/connections/tiktok' );
	apiFetch.mockReset();
	apiFetch.mockImplementation( async ( request ) =>
		request.path === '/pixelpair/v1/dashboard'
			? { platforms: { tiktok: { enabled: false } } }
			: {
					token_set: request.method === 'POST',
					test_active: false,
					test_code: '',
				}
	);
	const initial = {
		onboarding_complete: true,
		tiktok_enabled: false,
		tiktok_pixel_id: '',
		tiktok_capi_enabled: false,
		tiktok_advanced_matching: false,
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
	};
	const request = jest
		.fn()
		.mockResolvedValueOnce( initial )
		.mockImplementation( async ( req ) => ( { ...initial, ...req.data } ) );
	const registry = createRegistry();
	registry.register( createSettingsStore( request ) );
	render(
		<RegistryProvider value={ registry }>
			<App />
		</RegistryProvider>
	);
	await screen.findByRole( 'heading', { name: 'TikTok', level: 1 } );
	fireEvent.change( screen.getByLabelText( 'Pixel ID' ), {
		target: { value: "ttq.load('ABCDEFGHIJKLMNOPQRST');" },
	} );
	fireEvent.click( screen.getByLabelText( 'Track visits and events' ) );
	fireEvent.click(
		screen.getByLabelText( 'Send events from your server too' )
	);
	fireEvent.change( await screen.findByLabelText( 'Access token' ), {
		target: { value: 'fake_tiktok_fixture_token' },
	} );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Token saved' );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	expect( request.mock.calls[ 1 ][ 0 ].data ).toEqual( {
		tiktok_enabled: true,
		tiktok_pixel_id: 'ABCDEFGHIJKLMNOPQRST',
		tiktok_capi_enabled: true,
	} );
	expect(
		apiFetch.mock.calls.filter( ( [ call ] ) => call.method === 'POST' )
	).toEqual( [
		[
			{
				path: '/pixelpair/v1/tiktok',
				method: 'POST',
				data: { token: 'fake_tiktok_fixture_token' },
			},
		],
	] );
	expect( screen.queryByLabelText( 'Access token' ) ).not.toBeInTheDocument();
} );
