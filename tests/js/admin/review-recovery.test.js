import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';
import ConnectionCheck from '../../../assets/src/admin/components/ConnectionCheck';
import ConfigurationTransfer from '../../../assets/src/admin/components/ConfigurationTransfer';
jest.mock( '@wordpress/api-fetch', () => jest.fn() );
beforeEach( () => apiFetch.mockReset() );
test( 'initial settings failure stays recoverable after choosing another route', async () => {
	window.history.replaceState( null, '', '#/privacy' );
	const request = jest
		.fn()
		.mockRejectedValueOnce( new Error( 'Settings unavailable' ) )
		.mockResolvedValue( {
			onboarding_complete: true,
			excluded_roles: [],
			excluded_ips: [],
		} );
	const registry = createRegistry();
	registry.register( createSettingsStore( request ) );
	render(
		<RegistryProvider value={ registry }>
			<App />
		</RegistryProvider>
	);
	expect( await screen.findByRole( 'alert' ) ).toHaveTextContent(
		'Settings unavailable'
	);
	fireEvent.click( screen.getByRole( 'link', { name: 'Connections' } ) );
	expect( screen.getByRole( 'button', { name: 'Retry' } ) ).toBeVisible();
	fireEvent.click( screen.getByRole( 'link', { name: 'Privacy' } ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Retry' } ) );
	await screen.findByRole( 'heading', { name: 'Privacy', level: 1 } );
} );
test( 'a failed server check retains newly enabled test mode and its turn-off action', async () => {
	apiFetch
		.mockResolvedValueOnce( {
			test_code: 'TEST_REVIEW',
			test_active: true,
		} )
		.mockRejectedValueOnce( new Error( 'Network unavailable' ) );
	const refresh = jest.fn().mockResolvedValue( undefined );
	render(
		<ConnectionCheck
			platform="meta"
			settings={ { meta_capi_enabled: true } }
			credentials={ {
				token_set: true,
				test_code: '',
				test_active: false,
			} }
			onChecked={ refresh }
		/>
	);
	fireEvent.change( screen.getByLabelText( 'Test event code' ), {
		target: { value: 'TEST_REVIEW' },
	} );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Check connection' } )
	);
	await screen.findByText( /Network unavailable/ );
	expect(
		screen.getByRole( 'button', { name: 'Turn off test mode' } )
	).toBeVisible();
	expect( screen.getByLabelText( 'Test event code' ) ).toHaveValue(
		'TEST_REVIEW'
	);
	expect( refresh ).toHaveBeenCalled();
} );
test( 'import reload failure keeps stale preferences locked until refresh succeeds', async () => {
	apiFetch.mockResolvedValue( { success: true } );
	const load = jest
		.fn()
		.mockResolvedValueOnce( false )
		.mockResolvedValueOnce( true );
	const busy = jest.fn();
	render( <ConfigurationTransfer load={ load } onBusy={ busy } /> );
	fireEvent.click( screen.getByText( 'Import and export', { exact: true } ) );
	fireEvent.change( screen.getByLabelText( 'Import JSON preview' ), {
		target: {
			value: JSON.stringify( {
				format: 'pixelpair',
				version: 1,
				settings: {},
				events: [],
			} ),
		},
	} );
	fireEvent.click( screen.getByRole( 'button', { name: 'Review import' } ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Confirm import' } ) );
	await screen.findByText( /Imported, but settings could not refresh/ );
	expect( busy ).toHaveBeenLastCalledWith( true );
	expect(
		screen.getByRole( 'button', { name: 'Download settings JSON' } )
	).toBeDisabled();
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Refresh settings' } )
	);
	await waitFor( () => expect( busy ).toHaveBeenLastCalledWith( false ) );
	expect( apiFetch ).toHaveBeenCalledTimes( 1 );
} );
