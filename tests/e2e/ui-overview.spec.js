const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

for ( const width of [ 1280, 782, 600 ] ) {
	test( `Overview is accessible and responsive at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
		} );
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/overview' );
		await expect(
			page
				.locator( '.pixelpair-status' )
				.filter( { hasText: 'Browser configured' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'heading', { name: 'Overview', level: 1 } )
		).toBeFocused();
		await page.addScriptTag( {
			path: require.resolve( 'axe-core/axe.min.js' ),
		} );
		const violations = await page.evaluate( async () =>
			( await window.axe.run( '.pixelpair-app' ) ).violations.filter(
				( issue ) => [ 'serious', 'critical' ].includes( issue.impact )
			)
		);
		expect( violations ).toEqual( [] );
		expect(
			await page
				.locator( '.pixelpair-app' )
				.evaluate( ( app ) => app.scrollWidth <= app.clientWidth )
		).toBe( true );
		await page.screenshot( {
			path: test.info().outputPath( `overview-${ width }.png` ),
			fullPage: true,
		} );
		await page
			.getByRole( 'button', { name: 'Manage Meta', exact: true } )
			.click();
		await expect( page ).toHaveURL( /#\/connections\/meta$/ );
		await page.goBack();
		await expect(
			page.getByRole( 'heading', { name: 'Overview', level: 1 } )
		).toBeVisible();
	} );
}

test( 'Overview gives an honest retry after the status request fails', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: true } );
	await page.route( /pixelpair(?:%2F|\/)v1(?:%2F|\/)dashboard/, ( route ) =>
		route.fulfill( {
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify( {
				message: 'Status unavailable. Try again.',
			} ),
		} )
	);
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/overview' );
	await expect(
		page.locator( '.pixelpair-page [role="alert"]' )
	).toContainText( 'Status unavailable' );
	await page.unroute( /pixelpair(?:%2F|\/)v1(?:%2F|\/)dashboard/ );
	await page.getByRole( 'button', { name: 'Retry', exact: true } ).click();
	await expect(
		page.getByText( 'No connections are tracking yet.', { exact: false } )
	).toBeVisible();
} );
