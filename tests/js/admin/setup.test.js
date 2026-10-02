import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Dashboard from '../../../assets/src/admin/screens/Dashboard';
import ConnectionCheck from '../../../assets/src/admin/components/ConnectionCheck';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );
const initial = {
	meta_enabled: false,
	meta_pixel_id: '',
	meta_capi_enabled: false,
	ga4_enabled: false,
	ga4_ids: [],
	gtm_enabled: false,
	gtm_id: '',
	tiktok_enabled: false,
	tiktok_pixel_id: '',
	tiktok_capi_enabled: false,
	excluded_roles: [ 'editor' ],
	onboarding_complete: false,
};
beforeEach( () =>
	apiFetch.mockReset().mockResolvedValue( {
		token_set: false,
		test_active: false,
		test_code: '',
	} )
);

test( 'setup extracts a snippet, saves only its connection, and excludes administrators at finish', async () => {
	const save = jest.fn().mockResolvedValue( true );
	render(
		<Dashboard settings={ initial } save={ save } navigate={ jest.fn() } />
	);
	fireEvent.click(
		screen.getByLabelText( 'Facebook and Instagram ads (Meta)' )
	);
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Continue', exact: true } )
	);
	fireEvent.change( screen.getByLabelText( 'Meta Pixel ID' ), {
		target: { value: "<script>fbq('init', '123456789012345');</script>" },
	} );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Save and continue' } )
	);
	await screen.findByRole( 'heading', { name: 'Check it works', level: 1 } );
	expect( save.mock.calls[ 0 ][ 0 ] ).toEqual( {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
	} );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Continue', exact: true } )
	);
	fireEvent.click( screen.getByRole( 'button', { name: 'Finish setup' } ) );
	await waitFor( () =>
		expect( save ).toHaveBeenLastCalledWith( {
			onboarding_complete: true,
			excluded_roles: [ 'editor', 'administrator' ],
		} )
	);
} );

test( 'skip never persists connection drafts and failed saves stay on Connect', async () => {
	const save = jest
		.fn()
		.mockResolvedValueOnce( false )
		.mockResolvedValueOnce( true );
	render(
		<Dashboard
			settings={ initial }
			save={ save }
			error="Save failed. Try again."
			navigate={ jest.fn() }
		/>
	);
	fireEvent.click(
		screen.getByLabelText( 'Facebook and Instagram ads (Meta)' )
	);
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Continue', exact: true } )
	);
	fireEvent.change( screen.getByLabelText( 'Meta Pixel ID' ), {
		target: { value: '123456789012345' },
	} );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Save and continue' } )
	);
	await waitFor( () =>
		expect(
			screen.getByRole( 'button', { name: 'Save and continue' } )
		).toBeEnabled()
	);
	expect(
		screen.getByRole( 'heading', { name: 'Connect', level: 1 } )
	).toBeVisible();
	fireEvent.click( screen.getByRole( 'button', { name: 'Skip setup' } ) );
	await waitFor( () =>
		expect( save ).toHaveBeenLastCalledWith( { onboarding_complete: true } )
	);
} );

test( 'browser checks describe configuration without claiming vendor receipt', async () => {
	apiFetch.mockResolvedValue( {
		platforms: { meta: { enabled: true, id_set: true } },
	} );
	render(
		<ConnectionCheck
			platform="meta"
			settings={ { ...initial, meta_enabled: true } }
		/>
	);
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Check connection' } )
	);
	await waitFor( () =>
		expect( screen.getByRole( 'status' ) ).toHaveTextContent(
			'Browser tracking is configured'
		)
	);
	expect( apiFetch ).toHaveBeenCalledTimes( 1 );
	expect( apiFetch ).toHaveBeenCalledWith( {
		path: '/pixelpair/v1/dashboard',
	} );
} );

test( 'server checks require an explicit test code and explain a rejected token', async () => {
	apiFetch.mockImplementation( async ( request ) =>
		request.path.endsWith( '/test' )
			? { success: false, code: 401, response: { error_code: 190 } }
			: { token_set: true }
	);
	render(
		<ConnectionCheck
			platform="meta"
			settings={ {
				...initial,
				meta_enabled: true,
				meta_capi_enabled: true,
			} }
			credentials={ { token_set: true } }
		/>
	);
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Check connection' } )
	);
	expect( await screen.findByRole( 'alert' ) ).toHaveTextContent(
		'test event code'
	);
	expect( apiFetch ).not.toHaveBeenCalled();
	fireEvent.change( screen.getByLabelText( 'Test event code' ), {
		target: { value: 'TEST_FIXTURE' },
	} );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Check connection' } )
	);
	await waitFor( () =>
		expect( screen.getByRole( 'alert' ) ).toHaveTextContent(
			'Meta rejected the access token'
		)
	);
	expect( apiFetch ).toHaveBeenLastCalledWith( {
		path: '/pixelpair/v1/meta/test',
		method: 'POST',
	} );
} );
