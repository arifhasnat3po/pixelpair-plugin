import { startTracker } from '../../../assets/src/front/tracker';
const config = {
	tiktok: {
		enabled: true,
		pixel_id: 'C1234567890ABCDEFGHI',
		script_url: 'https://analytics.tiktok.com/i18n/pixel/events.js',
		server: true,
	},
	consent: {},
	event_url: '/event',
	bots: [],
};
const flush = async () => {
	for ( let n = 0; n < 12; n++ ) {
		await Promise.resolve();
	}
};
afterEach( () => {
	window.pixelpairRuntime?.stop();
	delete window.pixelpairRuntime;
	delete window.ttq;
	document.head.innerHTML = '';
	jest.useRealTimers();
} );
test( 'TikTok waits for marketing consent, shares browser/server IDs and revokes', async () => {
	const beacon = jest.fn( () => true );
	startTracker( { ...config, consent: { required: true } }, { beacon } );
	await flush();
	expect( document.scripts ).toHaveLength( 0 );
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	const script = document.querySelector( 'script' );
	expect( script.src ).toContain( 'sdkid=C1234567890ABCDEFGHI' );
	const track = jest.fn();
	window.ttq.track = track;
	script.dispatchEvent( new Event( 'load' ) );
	await flush();
	expect( track ).toHaveBeenCalledTimes( 1 );
	expect( track.mock.calls[ 0 ][ 2 ].event_id ).toBe(
		JSON.parse( beacon.mock.calls[ 0 ][ 1 ] ).event_id
	);
	expect( JSON.parse( beacon.mock.calls[ 0 ][ 1 ] ).platform ).toBe(
		'tiktok'
	);
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: false } } )
	);
	expect( window.pixelpairRuntime.tiktokSend( 'Purchase', {}, 'id' ) ).toBe(
		false
	);
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	expect( track ).toHaveBeenCalledTimes( 1 );
} );
test( 'failed strict eligibility or SDK never dispatches a TikTok event', async () => {
	const fetch = jest.fn().mockResolvedValue( {
		ok: true,
		json: async () => ( { allowed: false } ),
	} );
	startTracker(
		{ ...config, gate: { required: true, url: '/gate' } },
		{ fetch }
	);
	await flush();
	expect( document.scripts ).toHaveLength( 0 );
	window.pixelpairRuntime.stop();
	delete window.pixelpairRuntime;
	startTracker( config, { fetch } );
	await flush();
	document.querySelector( 'script' ).dispatchEvent( new Event( 'error' ) );
	await flush();
	expect( window.pixelpairRuntime.tiktokSend ).toBeUndefined();
} );
