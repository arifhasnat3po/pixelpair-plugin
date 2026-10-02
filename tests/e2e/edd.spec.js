const { test, expect } = require( '@playwright/test' );
const { execFileSync } = require( 'node:child_process' );
const path = require( 'node:path' );
const { readFileSync } = require( 'node:fs' );
const { interceptMeta, visitorOptions } = require( './fixtures/wordpress' );
test.use( visitorOptions );
test.setTimeout( 90000 );
let fixture;

test.beforeAll( () => {
	if ( process.env.PIXELPAIR_EDD_FIXTURE ) {
		fixture = JSON.parse(
			readFileSync( process.env.PIXELPAIR_EDD_FIXTURE, 'utf8' )
		);
		return;
	}
	fixture = JSON.parse(
		execFileSync(
			process.env.PIXELPAIR_PHP,
			[
				process.env.PIXELPAIR_WP_CLI,
				'--path=' + process.env.PIXELPAIR_TEST_WP_ROOT,
				'eval-file',
				path.resolve( __dirname, '../fixtures/edd.php' ),
			],
			{ encoding: 'utf8' }
		)
	);
} );

test.beforeEach( async ( { context } ) => {
	await interceptMeta( context );
	await context.route( 'https://www.googletagmanager.com/**', ( r ) =>
		r.fulfill( {
			contentType: 'application/javascript',
			body: '/* intercepted */',
		} )
	);
	await context.route( 'https://analytics.tiktok.com/**', ( r ) =>
		r.fulfill( {
			contentType: 'application/javascript',
			body: 'window.tiktokCalls=[];window.ttq.track=(...args)=>window.tiktokCalls.push(args);',
		} )
	);
} );

test( 'EDD variable price Ajax cart and paid guest receipt share IDs across TikTok and Meta', async ( {
	page,
} ) => {
	await page.goto( '/?p=' + fixture.id );
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.metaCalls?.filter(
							( c ) => c[ 1 ] === 'ViewContent'
						).length || 0
				),
			{ timeout: 20000 }
		)
		.toBe( 1 );
	await page
		.locator( 'input[name^="edd_options[price_id]"][value="1"]' )
		.check();
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.metaCalls?.filter(
							( c ) => c[ 1 ] === 'ViewContent'
						).length || 0
				),
			{ timeout: 20000 }
		)
		.toBe( 2 );
	await page.locator( '.edd-add-to-cart' ).first().click();
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.metaCalls?.filter(
							( c ) => c[ 1 ] === 'AddToCart'
						).length || 0
				),
			{ timeout: 20000 }
		)
		.toBe( 1 );
	await page.goto( '/?page_id=' + fixture.checkout );
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.metaCalls?.filter(
							( c ) => c[ 1 ] === 'InitiateCheckout'
						).length || 0
				),
			{ timeout: 20000 }
		)
		.toBe( 1 );
	await page
		.locator( '#edd-email' )
		.fill( 'guest-' + Date.now() + '@example.test' );
	await page.locator( '#edd-first' ).fill( 'Test' );
	await page.locator( '#edd-last' ).fill( 'Buyer' );
	// Hold the receipt's TikTok SDK until Meta has sent its independent purchase.
	let releaseTikTok;
	const tiktokReady = new Promise( ( resolve ) => {
		releaseTikTok = resolve;
	} );
	await page.route( 'https://analytics.tiktok.com/**', async ( route ) => {
		await tiktokReady;
		await route.fulfill( {
			contentType: 'application/javascript',
			body: 'window.tiktokCalls=[];window.ttq.track=(...args)=>window.tiktokCalls.push(args);',
		} );
	} );
	await page.locator( '#edd-purchase-button' ).click();
	const confirmation = new URL( fixture.confirmation_url );
	await page.waitForURL(
		( url ) =>
			url.origin === confirmation.origin &&
			url.pathname === confirmation.pathname &&
			[ ...confirmation.searchParams ].every(
				( [ key, value ] ) => url.searchParams.get( key ) === value
			),
		{ waitUntil: 'domcontentloaded' }
	);
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.metaCalls?.filter(
							( c ) => c[ 1 ] === 'Purchase'
						).length || 0
				),
			{ timeout: 30000 }
		)
		.toBe( 1 );
	releaseTikTok();
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.tiktokCalls?.filter(
							( c ) => c[ 0 ] === 'Purchase'
						).length || 0
				),
			{ timeout: 30000 }
		)
		.toBe( 1 );
	const purchase = await page.evaluate( () => ( {
		meta: window.metaCalls.find( ( c ) => c[ 1 ] === 'Purchase' ),
		tiktok: window.tiktokCalls.find( ( c ) => c[ 0 ] === 'Purchase' ),
	} ) );
	expect( purchase.meta[ 2 ].value ).toBe( 25 );
	expect( purchase.tiktok[ 1 ].contents[ 0 ].content_id ).toBe(
		'EDD-BOOK_1'
	);
	expect( purchase.tiktok[ 2 ].event_id ).toBe( purchase.meta[ 3 ].eventID );
	await page.reload();
	await expect
		.poll( () => page.evaluate( () => window.pixelpairRuntime?.eventId ) )
		.toBeTruthy();
	expect(
		await page.evaluate(
			() =>
				window.metaCalls?.filter( ( c ) => c[ 1 ] === 'Purchase' ) || []
		)
	).toHaveLength( 0 );
} );
