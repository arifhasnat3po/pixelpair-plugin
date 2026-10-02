import { createRegistry } from '@wordpress/data';
import { waitFor } from '@testing-library/react';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';

test( 'queued nested event toggles and Undo merge into the latest saved settings', async () => {
	const initial = {
		automatic_events: {
			form_submit: {
				enabled: true,
				platforms: { meta: { name: 'Lead' } },
			},
			file_download: {
				enabled: true,
				platforms: { meta: { name: 'Download' } },
			},
		},
		meta_enabled: true,
	};
	let finish;
	const request = jest
		.fn()
		.mockResolvedValueOnce( initial )
		.mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					finish = resolve;
				} )
		)
		.mockImplementation( async ( req ) => ( { ...initial, ...req.data } ) );
	const registry = createRegistry();
	const store = createSettingsStore( request );
	registry.register( store );
	const actions = registry.dispatch( store );
	await actions.load();
	const toggle = ( key, enabled ) =>
		actions.save( ( latest ) => ( {
			automatic_events: {
				...latest.automatic_events,
				[ key ]: { ...latest.automatic_events[ key ], enabled },
			},
		} ) );
	const first = toggle( 'form_submit', false );
	const second = toggle( 'file_download', false );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	expect(
		request.mock.calls[ 1 ][ 0 ].data.automatic_events.form_submit.enabled
	).toBe( false );
	finish( { ...initial, ...request.mock.calls[ 1 ][ 0 ].data } );
	await first;
	await second;
	await toggle( 'form_submit', true );
	expect( registry.select( store ).getSettings().automatic_events ).toEqual( {
		form_submit: initial.automatic_events.form_submit,
		file_download: {
			...initial.automatic_events.file_download,
			enabled: false,
		},
	} );
	expect( registry.select( store ).getSettings().meta_enabled ).toBe( true );
} );
