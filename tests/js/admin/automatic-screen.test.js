import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';

const mapping = {
	meta: {
		enabled: true,
		name: 'Lead',
		server: true,
		params: { content_name: 'Enquiry' },
	},
};
const initial = {
	onboarding_complete: true,
	meta_enabled: true,
	automatic_events: {
		page_view: { enabled: true, platforms: mapping },
		form_submit: { enabled: true, platforms: mapping },
		file_download: { enabled: true, platforms: mapping },
	},
	context_parameters: [ 'page_title' ],
	capture_form_fields: false,
	scroll_thresholds: [ 25, 50 ],
	time_thresholds: [ 30 ],
	download_extensions: [ 'pdf' ],
};
function mount( route = 'events' ) {
	window.history.replaceState( null, '', `#/${ route }` );
	let saved = initial;
	const request = jest.fn().mockImplementation( async ( req ) => {
		saved = { ...saved, ...req.data };
		return saved;
	} );
	const registry = createRegistry();
	registry.register( createSettingsStore( request ) );
	render(
		<RegistryProvider value={ registry }>
			<App />
		</RegistryProvider>
	);
	return request;
}
test( 'automatic events save immediately, keep Page views on, and Undo preserves other event settings', async () => {
	const request = mount();
	await screen.findByRole( 'heading', { name: 'Events', level: 1 } );
	expect( screen.getByLabelText( 'Page views' ) ).toBeDisabled();
	fireEvent.click( screen.getByLabelText( 'Form submissions' ) );
	await screen.findByText( 'Form submissions turned off.' );
	expect(
		screen.queryByRole( 'button', { name: 'Save changes' } )
	).not.toBeInTheDocument();
	fireEvent.click( screen.getByRole( 'button', { name: 'Undo' } ) );
	await screen.findByText( 'Change undone.' );
	expect( request.mock.calls[ 2 ][ 0 ].data.automatic_events ).toEqual(
		initial.automatic_events
	);
	expect( Object.keys( request.mock.calls[ 1 ][ 0 ].data ) ).toEqual( [
		'automatic_events',
	] );
} );
test( 'event details save mappings without changing another event and preview the configured payload', async () => {
	const request = mount( 'events/automatic/form_submit' );
	await screen.findByRole( 'heading', {
		name: 'Form submissions',
		level: 1,
	} );
	fireEvent.change( screen.getByLabelText( 'Meta event name' ), {
		target: { value: 'Contact' },
	} );
	fireEvent.click( screen.getByText( "Show what's sent", { exact: true } ) );
	expect( screen.getByText( /fbq\('track', "Contact"/ ) ).toHaveTextContent(
		'Enquiry'
	);
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	const patch = request.mock.calls[ 1 ][ 0 ].data;
	expect( patch.automatic_events.form_submit.platforms.meta.name ).toBe(
		'Contact'
	);
	expect( patch.automatic_events.file_download ).toEqual(
		initial.automatic_events.file_download
	);
} );
