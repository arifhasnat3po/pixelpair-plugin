const { test, expect } = require( '@playwright/test' );
const {
	login,
	settings,
	interceptMeta,
	visitorOptions,
} = require( './fixtures/wordpress' );

test.beforeEach( async ( { page } ) => {
	await login( page );
} );

test.afterEach( async ( { page } ) => {
	await settings( page );
} );

test( 'excluded admin, bot, preview and builder contexts never request Meta', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		excluded_roles: [ 'administrator' ],
	} );
	const ownerCalls = await interceptMeta( page.context() );
	await page.goto( '/' );
	await expect(
		page.locator( 'script[src*="build/tracker.js"]' )
	).toHaveCount( 0 );
	expect( ownerCalls.sdk ).toBe( 0 );
	const bots = await browser.newContext( {
		baseURL,
		userAgent: 'Googlebot/2.1',
	} );
	const botCalls = await interceptMeta( bots );
	const bot = await bots.newPage();
	await bot.goto( '/' );
	await expect(
		bot.locator( 'script[src*="build/tracker.js"]' )
	).toHaveCount( 0 );
	expect( botCalls.sdk ).toBe( 0 );
	await bots.close();
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	const calls = await interceptMeta( context );
	const visitor = await context.newPage();
	for ( const path of [
		'/?preview=true',
		'/?elementor-preview=12',
		'/?et_fb=1',
		'/?bricks=run',
		'/?ct_builder=true',
		'/?fl_builder',
		'/?amp=1',
	] ) {
		await visitor.goto( path );
		await expect(
			visitor.locator( 'script[src*="build/tracker.js"]' )
		).toHaveCount( 0 );
	}
	expect( calls.sdk ).toBe( 0 );
	await context.close();
} );

test( 'fast mode sends one intercepted PageView with a fresh browser ID and no gate', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
	} );
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	const requests = await interceptMeta( context );
	const visitor = await context.newPage();
	const response = await visitor.goto( '/' );
	const html = await response.text();
	await expect
		.poll( () => visitor.evaluate( () => window.metaCalls?.length ) )
		.toBe( 2 );
	const first = await visitor.evaluate( () => window.metaCalls );
	expect( first[ 0 ] ).toEqual( [ 'init', '123456789012345' ] );
	expect( first[ 1 ].slice( 0, 3 ) ).toEqual( [ 'track', 'PageView', {} ] );
	expect( first[ 1 ][ 3 ].eventID ).toMatch(
		/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
	);
	expect( html ).not.toContain( first[ 1 ][ 3 ].eventID );
	expect( html ).not.toContain( 'excluded_roles' );
	expect( requests ).toEqual( { sdk: 1, gate: 0 } );
	await visitor.evaluate( () => {
		for ( let i = 0; i < 3; i++ ) {
			document.dispatchEvent(
				new CustomEvent( 'pixelpair:consent', {
					detail: { marketing: true },
				} )
			);
		}
	} );
	await expect
		.poll( () => visitor.evaluate( () => window.metaCalls.length ) )
		.toBe( 2 );
	await visitor.reload();
	await expect
		.poll( () => visitor.evaluate( () => window.metaCalls?.length ) )
		.toBe( 2 );
	expect(
		await visitor.evaluate( () => window.metaCalls[ 1 ][ 3 ].eventID )
	).not.toBe( first[ 1 ][ 3 ].eventID );
	await expect(
		visitor.locator( 'script[src*="build/tracker.js"]' )
	).toHaveAttribute( 'defer', '' );
	await context.close();
} );

test( 'forced denial and unresolved CMP do not load Meta; later grant is idempotent', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		deny_until_consent: true,
		strict_cache_mode: true,
	} );
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	const requests = await interceptMeta( context );
	const visitor = await context.newPage();
	await visitor.goto( '/' );
	await expect
		.poll( () =>
			visitor.evaluate( () => Boolean( window.pixelpairRuntime ) )
		)
		.toBe( true );
	expect( requests ).toEqual( { sdk: 0, gate: 0 } );
	await visitor.evaluate( () => {
		document.dispatchEvent(
			new CustomEvent( 'pixelpair:consent', {
				detail: { marketing: true },
			} )
		);
		document.dispatchEvent(
			new CustomEvent( 'pixelpair:consent', {
				detail: { marketing: true },
			} )
		);
	} );
	await expect
		.poll( () => visitor.evaluate( () => window.metaCalls?.length ) )
		.toBe( 2 );
	expect( requests ).toEqual( { sdk: 1, gate: 1 } );
	await context.close();
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
	} );
	const cmp = await browser.newContext( { baseURL, ...visitorOptions } );
	const cmpRequests = await interceptMeta( cmp );
	await cmp.addInitScript( () => {
		window.wp_has_consent = () => true;
	} );
	const unresolved = await cmp.newPage();
	await unresolved.goto( '/' );
	await expect
		.poll( () =>
			unresolved.evaluate( () => Boolean( window.pixelpairRuntime ) )
		)
		.toBe( true );
	expect( cmpRequests.sdk ).toBe( 0 );
	await unresolved.evaluate( () => {
		window.wp_consent_type = 'optin';
		document.dispatchEvent( new Event( 'wp_consent_type_defined' ) );
	} );
	await expect
		.poll( () => unresolved.evaluate( () => window.metaCalls?.length ) )
		.toBe( 2 );
	await cmp.close();
} );

test( 'a failed required gate produces no SDK requests', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		strict_cache_mode: true,
	} );
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	const requests = await interceptMeta( context );
	await context.route(
		'**/admin-ajax.php?action=pixelpair_bootstrap',
		( route ) => route.fulfill( { status: 503, body: 'Unavailable' } )
	);
	const visitor = await context.newPage();
	await visitor.goto( '/' );
	await expect
		.poll( () =>
			visitor.evaluate( () => window.pixelpairRuntime?.pending )
		)
		.toBe( false );
	expect( requests ).toEqual( { sdk: 0, gate: 1 } );
	await context.close();
} );
