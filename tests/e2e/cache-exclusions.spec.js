// Both branches are deliberate acceptance cases, including fast mode's documented limitation.
/* eslint-disable playwright/no-conditional-in-test, playwright/no-conditional-expect */
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

for ( const strict of [ false, true ] ) {
	test( `${ strict ? 'strict' : 'fast' } mode handles changed pixel settings behind cached HTML`, async ( {
		page,
		browser,
		baseURL,
	} ) => {
		await settings( page, {
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
			strict_cache_mode: strict,
		} );
		const context = await browser.newContext( {
			baseURL,
			...visitorOptions,
		} );
		await interceptMeta( context );
		const cached = await ( await context.request.get( '/' ) ).text();
		await settings( page, {
			meta_enabled: true,
			meta_pixel_id: '0123456789012345',
			strict_cache_mode: strict,
		} );
		const visitor = await context.newPage();
		await visitor.route( baseURL + '/', ( route ) =>
			route.fulfill( { contentType: 'text/html', body: cached } )
		);
		await visitor.goto( '/' );
		await expect
			.poll( () => visitor.evaluate( () => window.metaCalls?.length ) )
			.toBe( 2 );
		expect(
			await visitor.evaluate( () => window.metaCalls[ 0 ][ 1 ] )
		).toBe( strict ? '0123456789012345' : '123456789012345' );
		await context.close();
	} );

	test( `${ strict ? 'strict' : 'fast' } mode with a real excluded subscriber and mixed visitors`, async ( {
		page,
		browser,
		baseURL,
	} ) => {
		await settings( page, {
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
			strict_cache_mode: strict,
			excluded_roles: [ 'subscriber' ],
		} );
		const guest = await browser.newContext( {
			baseURL,
			...visitorOptions,
		} );
		const guestCalls = await interceptMeta( guest );
		const visitor = await guest.newPage();
		const response = await visitor.goto( '/' );
		const cached = await response.text();
		await expect
			.poll( () => visitor.evaluate( () => window.metaCalls?.length ) )
			.toBe( 2 );
		expect( guestCalls.gate ).toBe( strict ? 1 : 0 );
		const member = await browser.newContext( {
			baseURL,
			...visitorOptions,
		} );
		const memberCalls = await interceptMeta( member );
		const subscriber = await member.newPage();
		await login( subscriber, 'subscriber' );
		if ( strict ) {
			await subscriber.route( baseURL + '/', ( route ) =>
				route.fulfill( { contentType: 'text/html', body: cached } )
			);
		}
		await subscriber.goto( '/' );
		if ( strict ) {
			await expect
				.poll( () =>
					subscriber.evaluate(
						() => window.pixelpairRuntime?.pending
					)
				)
				.toBe( false );
			expect( memberCalls ).toEqual( { sdk: 0, gate: 1 } );
			const gate = await subscriber.evaluate( async () => {
				const r = await fetch( window.pixelpairConfig.gate.url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( {
						url: window.location.href,
						consent: { granted: true, source: 'default' },
					} ),
				} );
				return {
					cache: r.headers.get( 'Cache-Control' ),
					data: await r.json(),
				};
			} );
			expect( gate.cache ).toContain( 'no-store' );
			expect( gate.data.allowed ).toBe( false );
		} else {
			await expect(
				subscriber.locator( 'script[src*="build/tracker.js"]' )
			).toHaveCount( 0 );
			expect( memberCalls.sdk ).toBe( 0 );
			// Documented fast-mode limitation: shared guest HTML bypasses PHP's role decision.
			await subscriber.route( baseURL + '/', ( route ) =>
				route.fulfill( { contentType: 'text/html', body: cached } )
			);
			await subscriber.goto( '/' );
			await expect
				.poll( () =>
					subscriber.evaluate( () => window.metaCalls?.length )
				)
				.toBe( 2 );
			expect( memberCalls ).toEqual( { sdk: 1, gate: 0 } );
		}
		await guest.close();
		await member.close();
	} );
}

test( 'IP exclusions force a no-store gate in fast mode and ignore forwarded-address spoofing', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		excluded_ips: [ '0.0.0.0/0', '::/0' ],
	} );
	const context = await browser.newContext( {
		baseURL,
		...visitorOptions,
		extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.1' },
	} );
	const calls = await interceptMeta( context );
	const visitor = await context.newPage();
	await visitor.goto( '/' );
	await expect
		.poll( () =>
			visitor.evaluate( () => window.pixelpairRuntime?.pending )
		)
		.toBe( false );
	expect( calls ).toEqual( { sdk: 0, gate: 1 } );
	await context.close();
} );
