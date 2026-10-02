const { test, expect } = require( '@playwright/test' );
const {
	login,
	settings,
	interceptMeta,
	visitorOptions,
} = require( './fixtures/wordpress' );

test( 'CAPI credentials stay masked and browser transport shares the pixel ID', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await login( page );
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		meta_capi_enabled: true,
	} );
	await page
		.getByLabel( 'Access token', { exact: true } )
		.fill( 'EAAtest_not_a_real_credential_12345' );
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect(
		page.getByText( 'Token saved', { exact: true } )
	).toBeVisible();
	await expect(
		page.getByLabel( 'Access token', { exact: true } )
	).toHaveCount( 0 );
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	await interceptMeta( context );
	const events = [];
	await context.route(
		/(?:rest_route=.*|wp-json\/)pixelpair(?:%2F|\/)v1(?:%2F|\/)event/,
		async ( route ) => {
			events.push( JSON.parse( route.request().postData() ) );
			await route.fulfill( {
				status: 202,
				contentType: 'application/json',
				body: '{"accepted":true}',
			} );
		}
	);
	try {
		const visitor = await context.newPage();
		const response = await visitor.goto( '/' );
		await expect.poll( () => events.length ).toBe( 1 );
		const calls = await visitor.evaluate( () => window.metaCalls );
		expect( events[ 0 ].event_id ).toBe(
			calls.find( ( call ) => call[ 0 ] === 'track' )[ 3 ].eventID
		);
		expect( events[ 0 ].event_name ).toBe( 'page_view' );
		expect( await response.text() ).not.toContain( 'EAAtest' );
	} finally {
		await context.close();
		await page.getByText( 'Advanced', { exact: true } ).click();
		await page
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await expect(
			page.getByLabel( 'Access token', { exact: true } )
		).toBeVisible();
		await settings( page, {
			meta_capi_enabled: false,
			meta_advanced_matching: false,
		} );
	}
} );
