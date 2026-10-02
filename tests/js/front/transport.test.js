import { sendEvent } from '../../../assets/src/front/transport';

test( 'uses the exact pixel event ID in a bounded beacon and falls back if refused', async () => {
	const payloads = [];
	const beacon = ( url, body ) => {
		payloads.push( { url, body } );
		return true;
	};
	const decision = { granted: true, source: 'default' };
	const config = { event_url: '/wp-json/pixelpair/v1/event' };
	sendEvent( config, 'page_view', 'dedup-id', {}, decision, { beacon } );
	expect( JSON.parse( payloads[ 0 ].body ) ).toMatchObject( {
		event_name: 'page_view',
		event_id: 'dedup-id',
		consent: decision,
	} );
	let fallback;
	sendEvent( config, 'page_view', 'dedup-id', {}, decision, {
		beacon: () => false,
		fetch: async ( url, options ) => {
			fallback = options;
			return {};
		},
	} );
	expect( fallback.keepalive ).toBe( true );
	expect( JSON.parse( fallback.body ).event_id ).toBe( 'dedup-id' );
} );

test( 'denied consent creates neither beacon nor fetch request', () => {
	const calls = [];
	sendEvent(
		{ event_url: '/event' },
		'page_view',
		'id',
		{},
		{ granted: false },
		{ beacon: () => calls.push( 1 ), fetch: () => calls.push( 2 ) }
	);
	expect( calls ).toEqual( [] );
} );
