import {
	render,
	screen,
	fireEvent,
	waitFor,
	within,
} from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';
jest.mock( '@wordpress/api-fetch', () => jest.fn() );
const rule = {
	id: 7,
	name: 'Book a call',
	status: 'active',
	triggers: [ { type: 'click', value: '.book-call-btn' } ],
	conditions: [],
	platforms: {
		meta: { enabled: true, name: 'Contact', params: {}, server: true },
	},
	once_per_session: false,
};
function mount( fail = false ) {
	window.history.replaceState( null, '', '#/events/custom' );
	let rules = [ rule ];
	apiFetch.mockReset();
	apiFetch.mockImplementation( async ( req ) => {
		if ( req.method === 'DELETE' ) {
			rules = [];
			return { deleted: true };
		}
		if ( req.method === 'POST' ) {
			rules = [ req.data ];
			return req.data;
		}
		if ( fail ) {
			fail = false;
			throw new Error( 'Connection lost. Retry to load events.' );
		}
		return rules;
	} );
	const registry = createRegistry();
	registry.register(
		createSettingsStore( async () => ( {
			onboarding_complete: true,
			automatic_events: {},
		} ) )
	);
	render(
		<RegistryProvider value={ registry }>
			<App />
		</RegistryProvider>
	);
}
test( 'custom list recovers from a failed load and names a trigger without exposing rule JSON', async () => {
	mount( true );
	await screen.findByText( 'Connection lost. Retry to load events.' );
	fireEvent.click( screen.getByRole( 'button', { name: 'Retry' } ) );
	await screen.findByText( 'Book a call' );
	expect( screen.getByText( 'Clicks .book-call-btn' ) ).toBeVisible();
	expect( screen.getByRole( 'button', { name: 'New event' } ) ).toBeVisible();
} );
test( 'turning off a custom rule offers Undo and deleting names the event before sending DELETE', async () => {
	mount();
	await screen.findByText( 'Book a call' );
	fireEvent.click( screen.getByRole( 'button', { name: 'Turn off' } ) );
	await screen.findByRole( 'button', { name: 'Undo' } );
	fireEvent.click( screen.getByRole( 'button', { name: 'Undo' } ) );
	await waitFor( () =>
		expect(
			screen.getByRole( 'button', { name: 'Turn off' } )
		).toBeEnabled()
	);
	fireEvent.click( screen.getByText( 'More', { exact: true } ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Delete' } ) );
	const dialog = screen.getByRole( 'dialog', {
		name: 'Delete “Book a call”?',
	} );
	expect(
		apiFetch.mock.calls.some( ( [ req ] ) => req.method === 'DELETE' )
	).toBe( false );
	fireEvent.click(
		within( dialog ).getByRole( 'button', { name: 'Delete event' } )
	);
	await screen.findByText(
		'No custom events yet. Track button clicks, page visits, or scroll depth without code.'
	);
	expect(
		apiFetch.mock.calls.find( ( [ req ] ) => req.method === 'DELETE' )[ 0 ]
	).toMatchObject( {
		path: '/pixelpair/v1/events/7',
		data: { confirm: 'yes' },
	} );
} );
