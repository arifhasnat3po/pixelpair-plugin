import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Settings from '../../../assets/src/admin/screens/Settings';
jest.mock( '@wordpress/api-fetch', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );
const settings = {
	strict_cache_mode: false,
	trust_proxy: false,
	logging_enabled: false,
	log_retention_days: 7,
	debug_enabled: false,
	debug_hide_name: false,
	keep_data_on_uninstall: true,
};
beforeEach( () => {
	apiFetch.mockReset();
	window.pixelpairAdmin = {
		...window.pixelpairAdmin,
		canPermissions: true,
		roles: [
			{ slug: 'administrator', name: 'Administrator' },
			{ slug: 'editor', name: 'Editor' },
		],
	};
} );
test( 'settings share one save bar and report a partial permission failure without losing the draft', async () => {
	apiFetch
		.mockResolvedValueOnce( { roles: [ 'administrator' ] } )
		.mockRejectedValueOnce( new Error( 'Permission update rejected.' ) )
		.mockResolvedValue( { roles: [ 'administrator', 'editor' ] } );
	const save = jest.fn().mockResolvedValue( true );
	render(
		<Settings
			settings={ settings }
			save={ save }
			load={ jest.fn() }
			navigate={ jest.fn() }
		/>
	);
	await waitFor( () => expect( apiFetch ).toHaveBeenCalledTimes( 1 ) );
	fireEvent.click( screen.getByText( 'Permissions', { exact: true } ) );
	fireEvent.click( await screen.findByLabelText( 'Editor' ) );
	fireEvent.click( screen.getByLabelText( 'Record server activity' ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( /Preferences saved. Permissions were not saved/ );
	expect( screen.getByLabelText( 'Editor' ) ).toBeChecked();
	expect( save ).toHaveBeenCalledWith( { logging_enabled: true } );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Changes saved' );
	expect( apiFetch.mock.calls[ 2 ][ 0 ].data ).toEqual( {
		roles: [ 'administrator', 'editor' ],
	} );
} );
