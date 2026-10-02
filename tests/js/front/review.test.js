import { createGoogle } from '../../../assets/src/front/google';
import { createConsent } from '../../../assets/src/front/consent';
import { startAutomatic } from '../../../assets/src/front/automatic';
import { startTracker } from '../../../assets/src/front/tracker';
import { sendEvent } from '../../../assets/src/front/transport';
import { boundParams } from '../../../assets/src/front/params';
const googleConfig = {
	ga4: { enabled: true, ids: [ 'G-TEST123' ], layer: 'reviewLayer' },
};
let google, stop;
afterEach( () => {
	google?.stop?.();
	stop?.();
	window.pixelpairRuntime?.stop();
	delete window.pixelpairRuntime;
	delete window.reviewLayer;
	delete window.Cookiebot;
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	jest.useRealTimers();
} );
test( 'Google commands use Arguments and wait for readiness before accepting an event', async () => {
	google = createGoogle( googleConfig, createConsent() );
	expect( google.send( 'page_view', {}, 'first' ).ga4 ).toBe( false );
	const ready = google.ready( [ 'ga4' ] );
	expect( Object.prototype.toString.call( window.reviewLayer[ 0 ] ) ).toBe(
		'[object Arguments]'
	);
	expect(
		window.reviewLayer.some(
			( x ) => x[ 0 ] === 'event' || x[ 0 ] === 'config'
		)
	).toBe( false );
	document.scripts[ 0 ].dispatchEvent( new Event( 'load' ) );
	await ready;
	expect( google.send( 'page_view', {}, 'first' ).ga4 ).toBe( true );
} );
test( 'withdrawal during Google loading blocks events and loading failures do not count as sent', async () => {
	window.Cookiebot = {
		hasResponse: true,
		consent: { statistics: true, marketing: true },
	};
	google = createGoogle( googleConfig, createConsent() );
	const ready = google.ready( [ 'ga4' ] );
	window.Cookiebot.consent.statistics = false;
	google.update();
	document.scripts[ 0 ].dispatchEvent( new Event( 'load' ) );
	await ready;
	expect( google.send( 'page_view', {}, 'first' ).ga4 ).toBe( false );
	expect(
		window.reviewLayer.some(
			( x ) => x[ 0 ] === 'event' || x[ 0 ] === 'config'
		)
	).toBe( false );
	google.stop();
	delete window.reviewLayer;
	document.head.innerHTML = '';
	window.Cookiebot.consent.statistics = true;
	google = createGoogle( googleConfig, createConsent() );
	const failed = google.ready( [ 'ga4' ] );
	document.scripts[ 0 ].dispatchEvent( new Event( 'error' ) );
	await failed;
	expect( google.send( 'page_view', {}, 'failed' ).ga4 ).toBe( false );
} );
test( 'Google readiness timeout clears its listener and does not accept a late load', async () => {
	jest.useFakeTimers();
	google = createGoogle( googleConfig, createConsent() );
	const ready = google.ready( [ 'ga4' ] );
	const script = document.scripts[ 0 ];
	await jest.advanceTimersByTimeAsync( 10001 );
	await ready;
	script.dispatchEvent( new Event( 'load' ) );
	expect( google.send( 'page_view', {}, 'late' ).ga4 ).toBe( false );
} );
test( 'form statistics survive marketing withdrawal during optional digest', async () => {
	let finish;
	window.TextEncoder = require( 'util' ).TextEncoder;
	Object.defineProperty( window.crypto, 'subtle', {
		configurable: true,
		value: {
			digest: () =>
				new Promise( ( r ) => {
					finish = r;
				} ),
		},
	} );
	document.body.innerHTML =
		'<form class="wpcf7-form"><input type="email" value="test@example.test"></form>';
	let marketing = true;
	const send = jest.fn( () => true );
	stop = startAutomatic(
		{
			automatic: { form_submit: { enabled: true } },
			capture_form_fields: true,
			canMatch: () => marketing,
		},
		send,
		() => true
	);
	document
		.querySelector( 'form' )
		.dispatchEvent( new CustomEvent( 'wpcf7mailsent', { bubbles: true } ) );
	marketing = false;
	finish( new Uint8Array( 32 ).buffer );
	for ( let i = 0; i < 8; i++ ) {
		await Promise.resolve();
	}
	expect( send ).toHaveBeenCalledWith(
		'form_submit',
		expect.any( Object ),
		{}
	);
} );
test( 'transport supplies the actual browser mapping as validation metadata', () => {
	const beacon = jest.fn( () => true );
	sendEvent(
		{ event_url: '/event' },
		'custom_1',
		'id',
		{},
		{ granted: true, source: 'default' },
		{ beacon },
		undefined,
		'OldName'
	);
	expect( JSON.parse( beacon.mock.calls[ 0 ][ 1 ] ).expected_name ).toBe(
		'OldName'
	);
} );
test( 'final context and token values fit the ingestion contract even with Unicode and repeated tokens', () => {
	const raw = Object.fromEntries(
		Array.from( { length: 48 }, ( _, i ) => [
			'field_' + i,
			'😃'.repeat( 1000 ),
		] )
	);
	const data = boundParams( raw );
	expect( Object.keys( data ).length ).toBeLessThanOrEqual( 48 );
	expect( new Blob( [ JSON.stringify( data ) ] ).size ).toBeLessThanOrEqual(
		11000
	);
	for ( const value of Object.values( data ) ) {
		expect( Array.from( value ).length ).toBeLessThanOrEqual( 256 );
	}
} );
test( 'direct CMP action consent attaches only a resolved decision to a successful-action form', () => {
	window.Cookiebot = {
		hasResponse: true,
		consent: { statistics: true, marketing: false },
	};
	document.body.innerHTML = '<form method="post" id="loginform"></form>';
	startTracker( {
		action_consent_only: true,
		consent: { tools: [ 'cookiebot' ] },
	} );
	const form = document.querySelector( 'form' );
	form.dispatchEvent(
		new Event( 'submit', { bubbles: true, cancelable: true } )
	);
	const input = form.querySelector( '[name="pixelpair_action_consent"]' );
	expect( input ).not.toBeNull();
	expect( JSON.parse( input.value ) ).toMatchObject( {
		marketing: { granted: false },
		statistics: { granted: true, source: 'cookiebot' },
	} );
} );
