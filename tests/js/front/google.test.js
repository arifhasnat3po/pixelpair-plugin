import { createGoogle } from '../../../assets/src/front/google';
import { createConsent } from '../../../assets/src/front/consent';
import { startTracker } from '../../../assets/src/front/tracker';
const config = {
	ga4: {
		enabled: true,
		ids: [ 'G-ABC123', 'G-XYZ789' ],
		layer: 'pixelpairDataLayer',
		debug: true,
		server_url: 'https://metrics.example',
	},
	gtm: { enabled: true, id: 'GTM-ABC123', layer: 'otherLayer', only: true },
};
afterEach( () => {
	window.pixelpairRuntime?.stop();
	delete window.pixelpairRuntime;
	delete window.pixelpairDataLayer;
	delete window.otherLayer;
	delete window.Cookiebot;
	delete window.BorlabsCookie;
	delete window.consentApi;
	delete window.getCkyConsent;
	delete window.wp_has_consent;
	delete window.wp_consent_type;
	delete window.cmplz_has_consent;
	document.head.innerHTML = '';
	jest.useRealTimers();
} );
test( 'statistics alone loads GA4 once, defaults precede config and explicit PageView, GTM waits for both', async () => {
	window.Cookiebot = {
		hasResponse: true,
		consent: { statistics: true, marketing: false },
	};
	const consent = createConsent();
	const google = createGoogle( config, consent );
	const ready = google.ready( [ 'ga4' ] );
	document.scripts[ 0 ].dispatchEvent( new Event( 'load' ) );
	await ready;
	google.send( 'page_view', {}, 'one' );
	google.send( 'scroll', { percent_scrolled: 25 }, 'two' );
	expect( document.scripts ).toHaveLength( 1 );
	expect( document.scripts[ 0 ].src ).toContain( '&l=pixelpairDataLayer' );
	const q = window.pixelpairDataLayer.map( ( x ) => Array.from( x ) );
	expect( q[ 0 ][ 0 ] ).toBe( 'consent' );
	expect( q[ 0 ][ 2 ].ad_storage ).toBe( 'denied' );
	expect( q.filter( ( x ) => x[ 0 ] === 'config' ) ).toHaveLength( 2 );
	expect( q.find( ( x ) => x[ 0 ] === 'config' )[ 2 ].send_page_view ).toBe(
		false
	);
	expect(
		q.filter( ( x ) => x[ 0 ] === 'event' && x[ 1 ] === 'page_view' )
	).toHaveLength( 1 );
	expect( window.otherLayer ).toBeUndefined();
	window.Cookiebot.consent.marketing = true;
	google.update();
	await google.ready( [ 'gtm' ] );
	google.send( 'add_to_cart', { items: [ { item_id: '1' } ] }, 'three' );
	expect( window.otherLayer.slice( -2 ) ).toEqual( [
		{ ecommerce: null },
		{
			event: 'pixelpair_add_to_cart',
			pixelpair: {
				event_id: 'three',
				params: { items: [ { item_id: '1' } ] },
			},
			ecommerce: { items: [ { item_id: '1' } ] },
		},
	] );
	window.Cookiebot.consent.statistics = false;
	google.update();
	const count = window.pixelpairDataLayer.length;
	google.send( 'scroll', {}, 'four' );
	expect( window.pixelpairDataLayer ).toHaveLength( count );
} );
test( 'unresolved tools and force denied produce no external loader', () => {
	const google = createGoogle( config, createConsent( { required: true } ) );
	google.send( 'page_view', {}, 'one' );
	expect( document.scripts ).toHaveLength( 0 );
} );
test( 'direct service consent cannot grant an unknown Real Cookie Banner service', () => {
	window.consentApi = {
		consentSync: jest.fn( () => ( {
			consentGiven: true,
			cookie: null,
			cookieOptIn: true,
		} ) ),
	};
	const c = createConsent( { rcb_marketing: 'meta', rcb_statistics: 'ga4' } );
	expect( c.read().granted ).toBe( false );
	window.consentApi.consentSync.mockReturnValue( {
		consentGiven: true,
		cookie: { id: 12 },
		cookieOptIn: true,
	} );
	expect( c.read( 'statistics' ).granted ).toBe( true );
} );
test( 'Borlabs requires configured service IDs, CookieYes requires completed user choice', () => {
	window.BorlabsCookie = { Consents: { hasConsent: jest.fn( () => true ) } };
	expect( createConsent().read().granted ).toBe( false );
	expect(
		createConsent( { borlabs_marketing: 'meta' } ).read().granted
	).toBe( true );
	delete window.BorlabsCookie;
	window.getCkyConsent = () => ( {
		isUserActionCompleted: false,
		categories: { analytics: true, advertisement: true },
	} );
	expect( createConsent().read( 'statistics' ).granted ).toBe( false );
	window.getCkyConsent = () => ( {
		isUserActionCompleted: true,
		categories: { analytics: true, advertisement: false },
	} );
	expect( createConsent().read( 'statistics' ).granted ).toBe( true );
	expect( createConsent().read().granted ).toBe( false );
} );
test( 'WP Consent API and Complianz distinguish categories and unresolved type', () => {
	window.wp_has_consent = ( category ) => category === 'statistics';
	let c = createConsent();
	expect( c.read( 'statistics' ).granted ).toBe( false );
	window.wp_consent_type = 'optin';
	expect( c.read( 'statistics' ).granted ).toBe( true );
	expect( c.read().granted ).toBe( false );
	delete window.wp_has_consent;
	window.cmplz_has_consent = ( category ) => category === 'statistics';
	c = createConsent();
	expect( c.read( 'statistics' ).granted ).toBe( true );
	expect( c.read().granted ).toBe( false );
} );
test( 'Google-only strict tracking waits for authoritative gate, revocation prevents late loader', async () => {
	let resolve;
	const fetch = jest.fn(
		() =>
			new Promise( ( r ) => {
				resolve = r;
			} )
	);
	startTracker(
		{
			...config,
			gtm: { enabled: false },
			gate: { required: true, url: '/gate' },
			consent: {},
		},
		{ fetch }
	);
	expect( JSON.parse( fetch.mock.calls[ 0 ][ 1 ].body ).category ).toBe(
		'statistics'
	);
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', {
			detail: { statistics: false },
		} )
	);
	resolve( {
		ok: true,
		json: async () => ( { allowed: true, ga4: config.ga4 } ),
	} );
	for ( let i = 0; i < 12; i++ ) {
		await Promise.resolve();
	}
	expect( document.scripts ).toHaveLength( 0 );
} );
test( 'Google-only gate timeout covers a stalled response body', async () => {
	jest.useFakeTimers();
	startTracker(
		{
			...config,
			gtm: { enabled: false },
			gate: { required: true, url: '/gate' },
			consent: {},
		},
		{
			fetch: jest.fn( async () => ( {
				ok: true,
				json: () => new Promise( () => {} ),
			} ) ),
		}
	);
	await jest.advanceTimersByTimeAsync( 5100 );
	expect( document.scripts ).toHaveLength( 0 );
} );
