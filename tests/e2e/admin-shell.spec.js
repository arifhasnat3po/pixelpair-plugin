const { test, expect } = require( '@playwright/test' );
const { login } = require( './fixtures/wordpress' );

test( 'administrator sees the accessible shell without runtime errors', async ( {
	page,
} ) => {
	const errors = [];
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );
	const requests = [];
	page.on( 'request', ( request ) => requests.push( request.url() ) );
	await login( page );
	await page.goto( '/wp-admin/admin.php?page=pixelpair' );
	await page
		.locator( '.pixelpair-app' )
		.getByRole( 'link', { name: 'Connections', exact: true } )
		.click();
	await page
		.getByRole( 'button', { name: /^(Set up|Manage|Fix) Meta$/ } )
		.click();
	await expect(
		page.getByRole( 'heading', { name: 'Meta', level: 1 } )
	).toBeVisible();
	await expect(
		page.getByLabel( 'Pixel ID', { exact: true } )
	).toBeVisible();
	await expect( page.locator( '#pixelpair-admin' ) ).toHaveAttribute(
		'aria-label',
		'PixelPair settings'
	);
	expect( errors ).toEqual( [] );
	expect(
		requests.filter( ( url ) =>
			/(?:^|\.)(?:facebook\.net|facebook\.com|google-analytics\.com|googletagmanager\.com|tiktok\.com|tiktokcdn\.com)$/.test(
				new URL( url ).hostname
			)
		)
	).toEqual( [] );
} );

test( 'subscriber cannot open the app or load its assets', async ( {
	page,
} ) => {
	await login( page, 'subscriber' );
	const response = await page.goto( '/wp-admin/admin.php?page=pixelpair' );
	expect( response.status() ).toBe( 403 );
	await expect( page.locator( '#pixelpair-admin' ) ).toHaveCount( 0 );
	await expect(
		page.locator( 'script[src*="pixelpair/build/admin.js"]' )
	).toHaveCount( 0 );
} );

test( 'admin assets are absent from the dashboard and public pages', async ( {
	page,
} ) => {
	await login( page );
	await page.goto( '/wp-admin/index.php' );
	await expect(
		page.locator( 'script[src*="pixelpair/build/admin.js"]' )
	).toHaveCount( 0 );
	await page.goto( '/' );
	await expect(
		page.locator( 'script[src*="pixelpair/build/admin.js"]' )
	).toHaveCount( 0 );
	await expect(
		page.locator( 'link[href*="pixelpair/build/"]' )
	).toHaveCount( 0 );
} );
