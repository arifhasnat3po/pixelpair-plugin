import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );
const initial = {
	meta_enabled: false,
	meta_pixel_id: '',
	meta_capi_enabled: false,
	excluded_roles: [],
	excluded_ips: [],
	strict_cache_mode: true,
	onboarding_complete: true,
};
beforeEach( () =>
	apiFetch
		.mockReset()
		.mockImplementation( async ( request ) =>
			request.path === '/pixelpair/v1/dashboard'
				? { platforms: { meta: { enabled: false } } }
				: { token_set: false, test_active: false, test_code: '' }
		)
);
function mount( api ) {
	window.history.replaceState( null, '', '#/connections/meta' );
	const registry = createRegistry();
	const store = createSettingsStore( api );
	registry.register( store );
	render(
		<RegistryProvider value={ registry }>
			<App />
		</RegistryProvider>
	);
	return { registry, store };
}
test( 'Meta validates IDs and saves only its own changed fields', async () => {
	const api = jest
		.fn()
		.mockResolvedValueOnce( initial )
		.mockImplementation( async ( request ) => ( {
			...initial,
			...request.data,
		} ) );
	mount( api );
	await screen.findByRole( 'heading', { name: 'Meta', level: 1 } );
	expect(
		screen.queryByRole( 'button', { name: 'Save changes' } )
	).not.toBeInTheDocument();
	fireEvent.click( screen.getByLabelText( 'Track visits and events' ) );
	fireEvent.change( screen.getByLabelText( 'Pixel ID' ), {
		target: { value: '1e15' },
	} );
	expect( screen.getByLabelText( 'Pixel ID' ) ).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeDisabled();
	expect( api ).toHaveBeenCalledTimes( 1 );
	fireEvent.change( screen.getByLabelText( 'Pixel ID' ), {
		target: { value: '0123456789012345' },
	} );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Changes saved' );
	expect( api.mock.calls[ 1 ][ 0 ].data ).toEqual( {
		meta_pixel_id: '0123456789012345',
		meta_enabled: true,
	} );
} );
test( 'load failure retries and a failed save retains the editable draft', async () => {
	const api = jest
		.fn()
		.mockRejectedValueOnce( new Error( 'Offline' ) )
		.mockResolvedValueOnce( initial )
		.mockRejectedValueOnce( new Error( 'Save failed' ) );
	mount( api );
	expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Offline' );
	fireEvent.click( screen.getByRole( 'button', { name: 'Retry' } ) );
	await screen.findByLabelText( 'Pixel ID' );
	fireEvent.change( screen.getByLabelText( 'Pixel ID' ), {
		target: { value: '123456789012345' },
	} );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Save failed', {
		selector: '.pixelpair-feedback',
	} );
	expect( screen.getByLabelText( 'Pixel ID' ) ).toHaveValue(
		'123456789012345'
	);
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeEnabled();
} );
test( 'rapid saves are serialized and a failed optimistic update rolls back', async () => {
	let finish;
	const api = jest
		.fn()
		.mockResolvedValueOnce( initial )
		.mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					finish = resolve;
				} )
		)
		.mockRejectedValueOnce( new Error( 'Rejected' ) );
	const registry = createRegistry();
	const store = createSettingsStore( api );
	registry.register( store );
	const actions = registry.dispatch( store );
	await actions.load();
	const one = actions.save( { strict_cache_mode: true } );
	const two = actions.save( { strict_cache_mode: false } );
	await waitFor( () => expect( api ).toHaveBeenCalledTimes( 2 ) );
	finish( { ...initial, strict_cache_mode: true } );
	await one;
	await two;
	expect( api ).toHaveBeenCalledTimes( 3 );
	expect( registry.select( store ).getSettings().strict_cache_mode ).toBe(
		true
	);
	expect( registry.select( store ).getError() ).toBe( 'Rejected' );
} );
test( 'failed persistence never claims tracking was disabled', async () => {
	const api = jest
		.fn()
		.mockResolvedValueOnce( {
			...initial,
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
		} )
		.mockRejectedValueOnce(
			new Error( 'Previous settings remain active. Try again.' )
		);
	const { registry, store } = mount( api );
	await screen.findByLabelText( 'Track visits and events' );
	fireEvent.click( screen.getByLabelText( 'Track visits and events' ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Previous settings remain active. Try again.', {
		selector: '.pixelpair-feedback',
	} );
	expect( api.mock.calls[ 1 ][ 0 ].data.meta_enabled ).toBe( false );
	expect( registry.select( store ).getSettings().meta_enabled ).toBe( true );
	expect( screen.queryByText( 'Changes saved' ) ).not.toBeInTheDocument();
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeEnabled();
} );
