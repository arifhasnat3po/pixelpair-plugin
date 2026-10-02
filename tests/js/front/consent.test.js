import { createConsent } from '../../../assets/src/front/consent';

test( 'an integration grant never masks a detected CMP denial', () => {
	window.wp_has_consent = () => false;
	window.wp_consent_type = 'optin';
	const consent = createConsent( { tools: [ 'wp-consent-api' ] } );
	const stop = consent.subscribe( () => {} );
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	expect( consent.read().granted ).toBe( false );
	stop();
} );

afterEach( () => {
	for ( const key of [
		'wp_has_consent',
		'wp_consent_type',
		'wp_fallback_consent_type',
		'Cookiebot',
		'cmplz_has_consent',
	] ) {
		delete window[ key ];
	}
} );

test( 'no tool grants by default, owner-required and unresolved detected tools block', () => {
	expect( createConsent( {} ).read() ).toEqual( {
		granted: true,
		source: 'default',
	} );
	expect( createConsent( { required: true } ).read().granted ).toBe( false );
	expect( createConsent( { tools: [ 'cookiebot' ] } ).read().granted ).toBe(
		false
	);
} );

test( 'WP Consent API must resolve a consent type even when its fallback function returns true', () => {
	window.wp_has_consent = () => true;
	const consent = createConsent( {} );
	expect( consent.read().granted ).toBe( false );
	window.wp_consent_type = 'optin';
	expect( consent.read() ).toEqual( {
		granted: true,
		source: 'wp-consent-api',
	} );
	window.wp_has_consent = () => false;
	expect( consent.read().granted ).toBe( false );
} );

test( 'Cookiebot unresolved and declined decisions block; grant and revocation notify', () => {
	window.Cookiebot = { hasResponse: false, consent: { marketing: false } };
	const consent = createConsent( { tools: [ 'cookiebot' ] } );
	const changed = jest.fn();
	const stop = consent.subscribe( changed );
	expect( consent.read().granted ).toBe( false );
	window.Cookiebot = { hasResponse: true, consent: { marketing: true } };
	window.dispatchEvent( new Event( 'CookiebotOnAccept' ) );
	expect( consent.read().granted ).toBe( true );
	window.Cookiebot.consent.marketing = false;
	window.dispatchEvent( new Event( 'CookiebotOnDecline' ) );
	expect( consent.read().granted ).toBe( false );
	expect( changed ).toHaveBeenCalledTimes( 2 );
	stop();
} );

test( 'CookieYes and documented custom decisions work after unresolved state', () => {
	const consent = createConsent( { tools: [ 'cookieyes' ] } );
	const stop = consent.subscribe( () => {} );
	expect( consent.read().granted ).toBe( false );
	document.dispatchEvent(
		new CustomEvent( 'cookieyes_consent_update', {
			detail: { accepted: [ 'advertisement' ], rejected: [] },
		} )
	);
	expect( consent.read() ).toEqual( { granted: true, source: 'cookieyes' } );
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: false } } )
	);
	expect( consent.read().granted ).toBe( false );
	stop();
} );

test( 'CMP errors fail closed and an explicit PHP veto cannot be overridden', () => {
	window.cmplz_has_consent = () => {
		throw new Error( 'not ready' );
	};
	expect( createConsent( {} ).read().granted ).toBe( false );
	expect( createConsent( { blocked: true } ).read().granted ).toBe( false );
} );
