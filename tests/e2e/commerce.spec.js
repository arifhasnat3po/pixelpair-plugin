const { test, expect } = require( '@playwright/test' );
const { execFileSync } = require( 'node:child_process' );
const path = require( 'node:path' );
const { readFileSync } = require( 'node:fs' );
const {
	interceptMeta,
	visitorOptions,
	login,
} = require( './fixtures/wordpress' );
let fixture;
test.use( visitorOptions );
test.setTimeout( 90000 );

test.beforeAll( () => {
	if ( process.env.PIXELPAIR_COMMERCE_FIXTURE ) {
		fixture = JSON.parse(
			readFileSync( process.env.PIXELPAIR_COMMERCE_FIXTURE, 'utf8' )
		);
		return;
	}
	if (
		! process.env.PIXELPAIR_PHP ||
		! process.env.PIXELPAIR_WP_CLI ||
		! process.env.PIXELPAIR_TEST_WP_ROOT
	) {
		throw new Error(
			'Commerce requires the documented disposable WooCommerce fixture and PHP/WP-CLI paths.'
		);
	}
	fixture = JSON.parse(
		execFileSync(
			process.env.PIXELPAIR_PHP,
			[
				'-d',
				'memory_limit=512M',
				process.env.PIXELPAIR_WP_CLI,
				'--path=' + process.env.PIXELPAIR_TEST_WP_ROOT,
				'eval-file',
				path.resolve( __dirname, '../fixtures/commerce.php' ),
			],
			{ encoding: 'utf8' }
		)
	);
} );

test.beforeEach( async ( { context } ) => {
	await interceptMeta( context );
	await context.route( 'https://www.googletagmanager.com/**', ( route ) =>
		route.fulfill( {
			contentType: 'application/javascript',
			body: '/* intercepted */',
		} )
	);
} );

const event = ( page, name ) =>
	page.evaluate(
		( n ) => window.metaCalls?.filter( ( c ) => c[ 1 ] === n ) || [],
		name
	);

test( 'store settings screen saves and reloads a catalog identifier preference', async ( {
	page,
} ) => {
	await login( page );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/store/woocommerce' );
	await page.getByText( 'Advanced', { exact: true } ).click();
	await page
		.getByLabel( 'Product ID suffix', { exact: true } )
		.fill( '_feed' );
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
	await page.reload();
	await page.getByText( 'Advanced', { exact: true } ).click();
	await expect(
		page.getByLabel( 'Product ID suffix', { exact: true } )
	).toHaveValue( '_feed' );
	await page.getByLabel( 'Product ID suffix', { exact: true } ).fill( '' );
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
} );

test( 'confirmed checkout selections send payment and shipping information with shipping value', async ( {
	page,
} ) => {
	await page.goto( '/?p=' + fixture.physical );
	await page.locator( '.single_add_to_cart_button' ).click();
	await page.goto( '/?page_id=' + fixture.checkout );
	await page.locator( '#billing_postcode' ).fill( 'SW1A 1AA' );
	await page.locator( '#billing_city' ).fill( 'London' );
	await page.locator( '#billing_address_1' ).fill( '123 Test Street' );
	await page.locator( '#billing_first_name' ).click();
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.dataLayer?.find(
							( c ) =>
								c[ 0 ] === 'event' &&
								c[ 1 ] === 'add_shipping_info'
						)?.[ 2 ]?.shipping_tier
				),
			{ timeout: 20000 }
		)
		.toBe( 'flat_rate:' + fixture.shipping_id );
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.dataLayer?.find(
							( c ) =>
								c[ 0 ] === 'event' &&
								c[ 1 ] === 'add_payment_info'
						)?.[ 2 ]?.payment_type
				),
			{ timeout: 15000 }
		)
		.toBe( 'cod' );
} );

test( 'classic Ajax cart confirmations dispatch once even when translated to Blocks events', async ( {
	page,
} ) => {
	await page.goto( '/?page_id=' + fixture.catalog );
	await expect
		.poll( async () => ( await event( page, 'PageView' ) ).length )
		.toBe( 1 );
	await page
		.locator(
			'.ajax_add_to_cart[data-product_id="' + fixture.simple + '"]'
		)
		.click();
	await expect
		.poll( async () => ( await event( page, 'AddToCart' ) ).length, {
			timeout: 15000,
		} )
		.toBe( 1 );
	expect(
		( await event( page, 'AddToCart' ) )[ 0 ][ 2 ].content_ids
	).toEqual( [ 'shop_TP-SIMPLE' ] );
} );

test( 'variation and Store API additions reach a real Blocks checkout', async ( {
	page,
} ) => {
	await page.goto( '/?p=' + fixture.variable );
	await page
		.locator( 'select[name="attribute_size"]' )
		.selectOption( 'Large' );
	await page.locator( '.single_add_to_cart_button' ).click();
	await expect
		.poll( async () => ( await event( page, 'AddToCart' ) ).length, {
			timeout: 15000,
		} )
		.toBe( 1 );
	expect(
		( await event( page, 'AddToCart' ) )[ 0 ][ 2 ].content_ids
	).toEqual( [ 'shop_' + fixture.variation ] );
	const result = await page.evaluate( async ( id ) => {
		const cart = await fetch( '/?rest_route=/wc/store/v1/cart' );
		const response = await fetch(
			'/?rest_route=/wc/store/v1/cart/add-item',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Nonce: cart.headers.get( 'nonce' ),
				},
				body: JSON.stringify( { id, quantity: 1 } ),
			}
		);
		if ( response.ok ) {
			document.body.dispatchEvent(
				new CustomEvent( 'wc-blocks_added_to_cart', { bubbles: true } )
			);
		}
		return response.status;
	}, fixture.simple );
	expect( result ).toBe( 201 );
	await expect
		.poll( async () => ( await event( page, 'AddToCart' ) ).length, {
			timeout: 15000,
		} )
		.toBe( 2 );
	await page.goto( '/?page_id=' + fixture.blocks );
	await page.locator( '#email' ).fill( 'blocks@example.test' );
	for ( const [ field, value ] of Object.entries( {
		'billing-first_name': 'Block',
		'billing-last_name': 'Buyer',
		'billing-address_1': '123 Test Street',
		'billing-city': 'London',
		'billing-postcode': 'SW1A 1AA',
	} ) ) {
		await page.locator( '#' + field ).fill( value );
	}
	await page
		.getByRole( 'button', { name: 'Place Order', exact: true } )
		.click();
	await expect( page.locator( '.woocommerce-order-received' ) ).toBeVisible( {
		timeout: 30000,
	} );
	await expect
		.poll( async () => ( await event( page, 'Purchase' ) ).length, {
			timeout: 15000,
		} )
		.toBe( 1 );
	expect( ( await event( page, 'Purchase' ) )[ 0 ][ 2 ].value ).toBe( 30 );
} );

test( 'simple and grouped non-Ajax carts use confirmed quantities and configured SKU IDs', async ( {
	page,
} ) => {
	await page.goto( '/?p=' + fixture.simple );
	await expect
		.poll( async () => ( await event( page, 'ViewContent' ) ).length )
		.toBe( 1 );
	expect(
		( await event( page, 'ViewContent' ) )[ 0 ][ 2 ].content_ids
	).toEqual( [ 'shop_TP-SIMPLE' ] );
	await page.locator( 'input.qty' ).fill( '2' );
	await page.locator( '.single_add_to_cart_button' ).click();
	await expect
		.poll( async () => ( await event( page, 'AddToCart' ) ).length )
		.toBe( 1 );
	expect( ( await event( page, 'AddToCart' ) )[ 0 ][ 2 ].num_items ).toBe(
		2
	);
	await page.goto( '/?p=' + fixture.group );
	await page
		.locator( 'input[name="quantity[' + fixture.simple + ']"]' )
		.fill( '1' );
	await page
		.locator( 'input[name="quantity[' + fixture.second + ']"]' )
		.fill( '2' );
	await page.locator( '.single_add_to_cart_button' ).click();
	await expect
		.poll( async () => ( await event( page, 'AddToCart' ) ).length )
		.toBe( 2 );
	const adds = await event( page, 'AddToCart' );
	expect( adds.map( ( c ) => c[ 2 ].num_items ).sort() ).toEqual( [ 1, 2 ] );
	expect( adds[ 0 ][ 3 ].eventID ).not.toBe( adds[ 1 ][ 3 ].eventID );
} );

for ( const customer of [ 'guest', 'subscriber' ] ) {
	test(
		'classic ' +
			customer +
			' checkout applies a coupon and purchase is claimed once with HPOS',
		async ( { page } ) => {
			test.setTimeout( 90000 );
			if ( customer === 'subscriber' ) {
				await login( page, customer );
			}
			expect( fixture.hpos ).toBe( 'yes' );
			await page.goto(
				'/?p=' + fixture.simple + '&utm_source=commerce-test'
			);
			await page.locator( '.single_add_to_cart_button' ).click();
			await page.goto( '/?page_id=' + fixture.cart );
			await page.locator( '#coupon_code' ).fill( 'pixelpair25' );
			await page
				.getByRole( 'button', { name: 'Apply coupon', exact: true } )
				.click();
			await expect( page.locator( '.cart-discount' ) ).toBeVisible( {
				timeout: 15000,
			} );
			await page.goto( '/?page_id=' + fixture.checkout );
			await expect
				.poll(
					async () =>
						( await event( page, 'InitiateCheckout' ) ).length
				)
				.toBeGreaterThan( 0 );
			for ( const [ field, value ] of Object.entries( {
				billing_first_name: 'Test',
				billing_last_name: 'Buyer',
				billing_address_1: '123 Test Street',
				billing_city: 'London',
				billing_postcode: 'SW1A 1AA',
				billing_phone: '02079460000',
				billing_email: 'buyer@example.test',
			} ) ) {
				await page.locator( '#' + field ).fill( value );
			}
			await page.locator( '#place_order' ).click();
			await expect(
				page.locator( '.woocommerce-order-received' )
			).toBeVisible( {
				timeout: 30000,
			} );
			await expect
				.poll( async () => ( await event( page, 'Purchase' ) ).length )
				.toBe( 1 );
			const purchase = ( await event( page, 'Purchase' ) )[ 0 ];
			expect( purchase[ 2 ].value ).toBe( 7.5 );
			expect( purchase[ 2 ].currency ).toBe( 'GBP' );
			await expect
				.poll(
					() =>
						page.evaluate(
							() =>
								window.dataLayer?.find(
									( c ) =>
										c[ 0 ] === 'event' &&
										c[ 1 ] === 'purchase'
								)?.[ 2 ]?.event_id
						),
					{ timeout: 15000 }
				)
				.toBe( purchase[ 3 ].eventID );
			const config = await page.evaluate( () =>
				JSON.stringify( window.pixelpairConfig )
			);
			expect( config ).not.toContain( 'wc_order_' );
			expect( config ).not.toContain( 'buyer@example.test' );
			const receiptCheck = page.waitForResponse(
				( r ) =>
					r.url().includes( '/pixelpair/v1/commerce' ) &&
					r.request().postDataJSON()?.action === 'purchase'
			);
			await page.reload();
			await receiptCheck;
			expect( await event( page, 'Purchase' ) ).toHaveLength( 0 );
		}
	);
}
