const { test, expect } = require( '@playwright/test' );
const {
	login,
	settings,
	interceptMeta,
	visitorOptions,
} = require( './fixtures/wordpress' );

test( 'custom event editor saves, previews, duplicates, pauses and deletes a real click rule', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await login( page );
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		ga4_enabled: true,
		ga4_ids: [ 'G-ABC123' ],
		google_data_layer: 'pixelpairDataLayer',
	} );
	await page.reload();
	await page
		.locator( '.pixelpair-app' )
		.getByRole( 'link', { name: 'Events', exact: true } )
		.click();
	await page.getByRole( 'link', { name: 'Custom', exact: true } ).click();
	await page
		.getByRole( 'button', { name: /^(New event|Create an event)$/ } )
		.click();
	await page.getByLabel( 'Event name', { exact: true } ).fill( 'Offer test' );
	await page.getByLabel( 'Turn on this event', { exact: true } ).check();
	await page.getByLabel( 'When', { exact: true } ).selectOption( 'click' );
	await page
		.getByLabel( 'An element matching', { exact: true } )
		.fill( '.test-offer' );
	await page
		.getByLabel( 'Meta event name', { exact: true } )
		.fill( 'OfferViewed' );
	await page
		.getByRole( 'button', { name: 'Google Analytics', exact: true } )
		.click();
	await page
		.getByLabel( 'Send to Google Analytics', { exact: true } )
		.check();
	await page
		.getByLabel( 'Google Analytics event name', { exact: true } )
		.fill( 'offer_viewed' );
	await page
		.getByRole( 'button', { name: 'Tag Manager', exact: true } )
		.click();
	await page.getByLabel( 'Send to Tag Manager', { exact: true } ).check();
	await page
		.getByLabel( 'Tag Manager event name', { exact: true } )
		.fill( 'offer_viewed' );
	await page.getByText( 'Advanced', { exact: true } ).click();
	await page.getByText( 'Show rule definition', { exact: true } ).click();
	await expect(
		page.getByLabel( 'Rule definition', { exact: true } )
	).toContainText( '.test-offer' );
	await page
		.getByRole( 'button', { name: 'Save and turn on', exact: true } )
		.click();
	const rows = page.getByRole( 'row' );
	const row = rows.filter( {
		has: page.getByRole( 'rowheader', {
			name: 'Offer test',
			exact: true,
		} ),
	} );
	await expect( row ).toHaveCount( 1 );
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	await interceptMeta( context );
	await context.route( 'https://www.googletagmanager.com/**', ( route ) =>
		route.fulfill( {
			contentType: 'application/javascript',
			body: '/* intercepted */',
		} )
	);
	try {
		const visitor = await context.newPage();
		await visitor.goto( '/' );
		await expect
			.poll( () =>
				visitor.evaluate( () =>
					window.metaCalls?.some( ( c ) => c[ 1 ] === 'PageView' )
				)
			)
			.toBe( true );
		await visitor.evaluate( () => {
			const button = document.createElement( 'button' );
			button.className = 'test-offer';
			button.textContent = 'Offer';
			document.body.appendChild( button );
		} );
		await visitor
			.getByRole( 'button', { name: 'Offer', exact: true } )
			.click();
		await visitor
			.getByRole( 'button', { name: 'Offer', exact: true } )
			.click();
		expect(
			await visitor.evaluate(
				() =>
					window.metaCalls.filter( ( c ) => c[ 1 ] === 'OfferViewed' )
						.length
			)
		).toBe( 1 );
		expect(
			await visitor.evaluate(
				() =>
					window.pixelpairDataLayer.filter(
						( c ) => c[ 0 ] === 'event' && c[ 1 ] === 'offer_viewed'
					).length
			)
		).toBe( 1 );
		await row
			.getByRole( 'button', { name: 'Turn off', exact: true } )
			.click();
		await expect(
			row.getByRole( 'button', { name: 'Turn on', exact: true } )
		).toBeVisible();
		await row.getByText( 'More', { exact: true } ).click();
		await row
			.getByRole( 'button', { name: 'Duplicate', exact: true } )
			.click();
		await expect(
			page.getByRole( 'row' ).filter( { hasText: 'Offer test' } )
		).toHaveCount( 2 );
		await row.getByText( 'More', { exact: true } ).click();
	} finally {
		await context.close();
		const matches = page
			.getByRole( 'row' )
			.filter( { hasText: 'Offer test' } );
		while ( await matches.count() ) {
			const previousCount = await matches.count();
			await matches.first().getByText( 'More', { exact: true } ).click();
			await matches
				.first()
				.getByRole( 'button', { name: 'Delete', exact: true } )
				.click();
			await page
				.getByRole( 'button', { name: 'Delete event', exact: true } )
				.click();
			await expect( matches ).toHaveCount( previousCount - 1 );
			await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
		}
		await settings( page );
	}
} );

test( 'automatic search/download events honor a platform override and disabled context', async ( {
	page,
	browser,
	baseURL,
} ) => {
	await login( page );
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		context_parameters: [],
	} );
	const context = await browser.newContext( { baseURL, ...visitorOptions } );
	await interceptMeta( context );
	try {
		const visitor = await context.newPage();
		await visitor.goto( '/?s=pixelpair' );
		await expect
			.poll( () =>
				visitor.evaluate( () =>
					window.metaCalls?.some( ( c ) => c[ 1 ] === 'Search' )
				)
			)
			.toBe( true );
		const search = await visitor.evaluate( () =>
			window.metaCalls.find( ( c ) => c[ 1 ] === 'Search' )
		);
		expect( search[ 2 ] ).toEqual( { search_string: 'pixelpair' } );
		await visitor.evaluate( () => {
			const link = document.createElement( 'a' );
			link.href = '/sample.pdf';
			link.textContent = 'Sample download';
			link.addEventListener( 'click', ( e ) => e.preventDefault() );
			document.body.appendChild( link );
		} );
		await visitor.getByText( 'Sample download', { exact: true } ).click();
		await expect
			.poll( () =>
				visitor.evaluate(
					() =>
						window.metaCalls.filter(
							( c ) => c[ 1 ] === 'Download'
						).length
				)
			)
			.toBe( 1 );
	} finally {
		await context.close();
		await settings( page );
	}
} );
