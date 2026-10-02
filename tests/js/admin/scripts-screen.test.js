import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import Scripts from '../../../assets/src/admin/screens/Scripts';
jest.mock( '@wordpress/api-fetch', () => ( {
	__esModule: true,
	default: jest.fn(),
} ) );
const initial = Object.fromEntries(
	[ 'head', 'body', 'footer', 'receipt' ].map( ( key ) => [
		key,
		{ code: '', device: 'all', consent: 'marketing' },
	] )
);
beforeEach( () => {
	window.pixelpairAdmin = { ...window.pixelpairAdmin, canScripts: true };
	apiFetch.mockReset();
	apiFetch.mockResolvedValue( initial );
} );
test( 'location changes preserve drafts and failed script saves can be retried', async () => {
	render( <Scripts /> );
	fireEvent.change( await screen.findByLabelText( 'HTML and scripts' ), {
		target: { value: '<script>example()</script>' },
	} );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Footer', exact: true } )
	);
	fireEvent.change( screen.getByLabelText( 'HTML and scripts' ), {
		target: { value: '<p>Footer</p>' },
	} );
	apiFetch.mockRejectedValueOnce(
		new Error( 'Your permission expired. Sign in again.' )
	);
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Your permission expired. Sign in again.' );
	expect( screen.getByLabelText( 'HTML and scripts' ) ).toHaveValue(
		'<p>Footer</p>'
	);
	apiFetch.mockImplementationOnce( async ( request ) => request.data );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await screen.findByText( 'Changes saved' );
	expect( apiFetch.mock.calls[ 2 ][ 0 ].data ).toEqual( {
		...initial,
		head: { ...initial.head, code: '<script>example()</script>' },
		footer: { ...initial.footer, code: '<p>Footer</p>' },
	} );
	await waitFor( () =>
		expect(
			screen.queryByRole( 'button', { name: 'Save changes' } )
		).not.toBeInTheDocument()
	);
} );
test( 'a manager without script permission sees an explanation and no script request', async () => {
	window.pixelpairAdmin.canScripts = false;
	render( <Scripts /> );
	expect(
		screen.getByText(
			'Ask a site administrator for permission to manage scripts.'
		)
	).toBeVisible();
	expect( apiFetch ).not.toHaveBeenCalled();
} );
