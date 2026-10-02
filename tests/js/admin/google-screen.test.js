import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );
const initial = {
	onboarding_complete: true,
	ga4_enabled: false,
	ga4_ids: [],
	ga4_server_url: '',
	ga4_debug: false,
	google_data_layer: 'pixelpairDataLayer',
	meta_enabled: true,
	meta_pixel_id: '123456789012345',
};
function mount() {
	window.history.replaceState( null, '', '#/connections/ga4' );
	apiFetch.mockReset();
	apiFetch.mockResolvedValue( {
		platforms: { ga4: { enabled: false, id_set: false } },
	} );
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
	return request;
}
test( 'Google snippet extraction saves only its connection and the advanced fields start collapsed', async () => {
	const request = mount();
	await screen.findByRole( 'heading', {
		name: 'Google Analytics',
		level: 1,
	} );
	expect( screen.getByLabelText( 'Server container URL' ) ).not.toBeVisible();
	fireEvent.change( screen.getByLabelText( 'Measurement IDs' ), {
		target: { value: "<script>gtag('config', 'G-ABC12345');</script>" },
	} );
	expect( screen.getByLabelText( 'Measurement IDs' ) ).toHaveValue(
		'G-ABC12345'
	);
	fireEvent.click( screen.getByLabelText( 'Track visits and events' ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	expect( request.mock.calls[ 1 ][ 0 ].data ).toEqual( {
		ga4_enabled: true,
		ga4_ids: [ 'G-ABC12345' ],
	} );
} );
test( 'Google rejects unsafe advanced URLs and reserved data layer names before saving', async () => {
	const request = mount();
	await screen.findByLabelText( 'Measurement IDs' );
	fireEvent.click( screen.getByText( 'Advanced', { exact: true } ) );
	fireEvent.change( screen.getByLabelText( 'Server container URL' ), {
		target: { value: 'https://user:secret@example.test/?key=x' },
	} );
	expect( screen.getByLabelText( 'Server container URL' ) ).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeDisabled();
	fireEvent.change( screen.getByLabelText( 'Server container URL' ), {
		target: { value: '' },
	} );
	fireEvent.change( screen.getByLabelText( 'Data layer name' ), {
		target: { value: 'window' },
	} );
	expect( screen.getByLabelText( 'Data layer name' ) ).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	expect( request ).toHaveBeenCalledTimes( 1 );
} );
