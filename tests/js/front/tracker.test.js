import { startTracker } from '../../../assets/src/front/tracker';
import { waitFor } from '@testing-library/react';

const config = {
	meta: { enabled: true, pixel_id: '123456789012345' },
	meta_script_url: 'https://connect.facebook.net/en_US/fbevents.js',
	gate: {
		required: false,
		url: '/wp-admin/admin-ajax.php?action=pixelpair_bootstrap',
	},
	consent: {},
	bots: [],
};
const flush = async () => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

test( 'grant after revocation while loading resumes once the old attempt settles', async () => {
	startTracker( config );
	await flush();
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: false } } )
	);
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	document.querySelector( 'script' ).dispatchEvent( new Event( 'load' ) );
	await flush();
	await flush();
	expect( window.fbq.queue ).toHaveLength( 2 );
} );

test( 'the timeout also bounds a stalled response body', async () => {
	jest.useFakeTimers();
	const fetch = jest
		.fn()
		.mockResolvedValue( { ok: true, json: () => new Promise( () => {} ) } );
	startTracker(
		{ ...config, gate: { ...config.gate, required: true } },
		{ fetch }
	);
	await flush();
	await jest.advanceTimersByTimeAsync( 5100 );
	expect( window.pixelpairRuntime.pending ).toBe( false );
	expect( document.querySelectorAll( 'script' ) ).toHaveLength( 0 );
} );
afterEach( () => {
	window.pixelpairRuntime?.stop();
	delete window.pixelpairRuntime;
	delete window.fbq;
	delete window._fbq;
	delete window.Cookiebot;
	document.head.innerHTML = '';
	jest.useRealTimers();
} );

test( 'one official async loader, init and PageView per document despite repeated starts and grants', async () => {
	const fetch = jest.fn();
	startTracker( config, { fetch } );
	startTracker( config, { fetch } );
	await flush();
	const script = document.querySelector(
		'script[src="https://connect.facebook.net/en_US/fbevents.js"]'
	);
	expect( script ).not.toBeNull();
	expect( script.async ).toBe( true );
	expect( window.fbq.queue ).toHaveLength( 0 );
	script.dispatchEvent( new Event( 'load' ) );
	await flush();
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	expect( document.querySelectorAll( 'script' ) ).toHaveLength( 1 );
	expect( window.fbq.queue.map( ( args ) => Array.from( args ) ) ).toEqual( [
		[ 'init', config.meta.pixel_id ],
		[
			'track',
			'PageView',
			{},
			{ eventID: window.pixelpairRuntime.eventId },
		],
	] );
	expect( fetch ).not.toHaveBeenCalled();
} );

test( 'required gate failures and disabled authoritative settings make zero Meta requests', async () => {
	const fetch = jest.fn().mockResolvedValue( { ok: false } );
	startTracker(
		{ ...config, gate: { ...config.gate, required: true } },
		{ fetch }
	);
	await flush();
	expect( document.querySelectorAll( 'script' ) ).toHaveLength( 0 );
	expect( fetch ).toHaveBeenCalledTimes( 1 );
	window.pixelpairRuntime.stop();
	delete window.pixelpairRuntime;
	fetch.mockResolvedValue( {
		ok: true,
		json: async () => ( {
			allowed: true,
			marketing_allowed: true,
			meta: { enabled: false, pixel_id: '' },
		} ),
	} );
	startTracker(
		{ ...config, gate: { ...config.gate, required: true } },
		{ fetch }
	);
	await flush();
	expect( document.querySelectorAll( 'script' ) ).toHaveLength( 0 );
} );

test( 'a denied visitor never loads Meta; a later grant uses the fresh gate settings once', async () => {
	window.Cookiebot = { hasResponse: true, consent: { marketing: false } };
	const fetch = jest.fn().mockResolvedValue( {
		ok: true,
		json: async () => ( {
			allowed: true,
			marketing_allowed: true,
			meta: { enabled: true, pixel_id: '0123456789012345' },
		} ),
	} );
	startTracker(
		{ ...config, gate: { ...config.gate, required: true } },
		{ fetch }
	);
	await flush();
	expect( fetch ).not.toHaveBeenCalled();
	window.Cookiebot.consent.marketing = true;
	window.dispatchEvent( new Event( 'CookiebotOnAccept' ) );
	window.dispatchEvent( new Event( 'CookiebotOnAccept' ) );
	await flush();
	expect( fetch ).toHaveBeenCalledTimes( 1 );
	await waitFor( () =>
		expect( document.querySelector( 'script' ) ).not.toBeNull()
	);
	document.querySelector( 'script' ).dispatchEvent( new Event( 'load' ) );
	await flush();
	expect( Array.from( window.fbq.queue[ 0 ] ) ).toEqual( [
		'init',
		'0123456789012345',
	] );
} );

test( 'revocation while the SDK is loading prevents a late event; a later grant sends only once', async () => {
	startTracker( config );
	await flush();
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: false } } )
	);
	document.querySelector( 'script' ).dispatchEvent( new Event( 'load' ) );
	await flush();
	expect( window.fbq.queue ).toHaveLength( 0 );
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	expect( window.fbq.queue ).toHaveLength( 2 );
} );

test( 'a required gate times out and never starts the SDK', async () => {
	jest.useFakeTimers();
	const fetch = jest.fn( () => new Promise( () => {} ) );
	startTracker(
		{ ...config, gate: { ...config.gate, required: true } },
		{ fetch }
	);
	await flush();
	await jest.advanceTimersByTimeAsync( 5100 );
	expect( document.querySelectorAll( 'script' ) ).toHaveLength( 0 );
	expect( window.pixelpairRuntime.eventId ).toBeNull();
} );
