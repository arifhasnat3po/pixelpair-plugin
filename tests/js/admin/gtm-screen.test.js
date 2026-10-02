import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';
jest.mock( '@wordpress/api-fetch', () => jest.fn() );
const initial = {
	onboarding_complete: true,
	gtm_enabled: false,
	gtm_id: '',
	gtm_server_url: '',
	gtm_data_layer: 'pixelpairDataLayer',
	gtm_data_layer_only: false,
	meta_enabled: true,
};
function mount() {
	window.history.replaceState( null, '', '#/connections/gtm' );
	apiFetch.mockReset();
	apiFetch.mockResolvedValue( {
		platforms: { gtm: { enabled: false, id_set: false } },
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
test( 'Tag Manager requires an ID unless an existing loader is selected', async () => {
	const request = mount();
	await screen.findByRole( 'heading', { name: 'Tag Manager', level: 1 } );
	fireEvent.click( screen.getByLabelText( 'Track visits and events' ) );
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeDisabled();
	fireEvent.click( screen.getByText( 'Advanced', { exact: true } ) );
	fireEvent.click(
		screen.getByLabelText( 'Use a container loaded by another plugin' )
	);
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeEnabled();
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	expect( request.mock.calls[ 1 ][ 0 ].data ).toEqual( {
		gtm_enabled: true,
		gtm_data_layer_only: true,
	} );
} );
