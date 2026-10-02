import { connectionStatus } from '../../../assets/src/admin/data/connections';
import { createRegistry } from '@wordpress/data';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';

test( 'a configured data-layer-only connection does not require a container ID', () => {
	expect(
		connectionStatus( {
			enabled: true,
			id_set: false,
			data_layer_only: true,
		} )
	).toMatchObject( {
		text: 'Data layer configured',
		action: 'Manage',
		status: 'info',
	} );
} );

test( 'configuration is never presented as confirmed vendor delivery', () => {
	expect( connectionStatus( { enabled: true, id_set: true } ) ).toMatchObject(
		{ text: 'Browser configured', action: 'Manage', status: 'info' }
	);
	expect( connectionStatus( { enabled: false, id_set: true } ).text ).toBe(
		'Tracking off'
	);
} );
test( 'missing tokens and rejected server deliveries lead to Fix', () => {
	expect(
		connectionStatus( {
			enabled: true,
			id_set: true,
			server_enabled: true,
		} )
	).toMatchObject( {
		text: 'Access token needed',
		action: 'Fix',
		status: 'error',
	} );
	expect(
		connectionStatus( {
			enabled: true,
			id_set: true,
			server_enabled: true,
			credentials_set: true,
			last_event: { status: 'failed' },
		} ).action
	).toBe( 'Fix' );
} );
test( 'a partial optimistic save keeps unrelated settings available', async () => {
	let finish;
	const initial = { meta_enabled: false, excluded_roles: [ 'editor' ] };
	const request = jest
		.fn()
		.mockResolvedValueOnce( initial )
		.mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					finish = resolve;
				} )
		);
	const registry = createRegistry();
	const store = createSettingsStore( request );
	registry.register( store );
	await registry.dispatch( store ).load();
	const write = registry.dispatch( store ).save( { meta_enabled: true } );
	await Promise.resolve();
	expect( registry.select( store ).getSettings().excluded_roles ).toEqual( [
		'editor',
	] );
	finish( { ...initial, meta_enabled: true } );
	await write;
	expect( request.mock.calls[ 1 ][ 0 ].data ).toEqual( {
		meta_enabled: true,
	} );
} );
