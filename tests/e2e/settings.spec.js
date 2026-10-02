const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

test( 'Meta settings persist, reject invalid IDs and recover from a failed save', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, {
		onboarding_complete: true,
		strict_cache_mode: true,
	} );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/connections/meta' );
	await page
		.getByLabel( 'Pixel ID', { exact: true } )
		.fill( '0123456789012345' );
	await page.getByLabel( 'Track visits and events', { exact: true } ).check();
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect(
		page
			.locator( '.pixelpair-feedback' )
			.filter( { hasText: 'Changes saved' } )
	).toBeVisible();
	await page.reload();
	await expect( page.getByLabel( 'Pixel ID', { exact: true } ) ).toHaveValue(
		'0123456789012345'
	);
	await expect(
		page.getByLabel( 'Track visits and events', { exact: true } )
	).toBeChecked();
	await page.getByLabel( 'Pixel ID', { exact: true } ).fill( '1e15' );
	await expect(
		page.getByRole( 'button', { name: 'Save changes', exact: true } )
	).toBeDisabled();
	await expect(
		page.getByLabel( 'Pixel ID', { exact: true } )
	).toHaveAttribute( 'aria-invalid', 'true' );
	await page
		.getByLabel( 'Pixel ID', { exact: true } )
		.fill( '123456789012345' );
	await page.route( /pixelpair(?:%2F|\/)v1(?:%2F|\/)settings/, ( route ) =>
		route.request().method() === 'POST'
			? route.fulfill( {
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify( {
						message: 'Settings could not be saved. Try again.',
					} ),
				} )
			: route.continue()
	);
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect(
		page.locator( '.pixelpair-feedback[role="alert"]' )
	).toContainText( 'Settings could not be saved' );
	await expect( page.getByLabel( 'Pixel ID', { exact: true } ) ).toHaveValue(
		'123456789012345'
	);
	await page.unroute( /pixelpair(?:%2F|\/)v1(?:%2F|\/)settings/ );
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect(
		page
			.locator( '.pixelpair-feedback' )
			.filter( { hasText: 'Changes saved' } )
	).toBeVisible();
	const stored = await page.evaluate( async () =>
		(
			await fetch( window.pixelpairAdmin.settingsUrl, {
				headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
			} )
		).json()
	);
	expect( stored.meta_pixel_id ).toBe( '123456789012345' );
	expect( stored.strict_cache_mode ).toBe( true );
	await settings( page, { onboarding_complete: true } );
} );

test( 'global settings persist and invalid IP addresses are caught before saving', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, {
		onboarding_complete: true,
		strict_cache_mode: false,
	} );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/settings' );
	await page.getByText( 'Advanced', { exact: true } ).click();
	await page.getByLabel( 'Strict cache mode', { exact: true } ).check();
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
	await page.reload();
	await page.getByText( 'Advanced', { exact: true } ).click();
	await expect(
		page.getByLabel( 'Strict cache mode', { exact: true } )
	).toBeChecked();
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/privacy' );
	await page
		.getByLabel( 'IP addresses', { exact: true } )
		.fill( '999.1.1.1' );
	await expect(
		page.getByRole( 'button', { name: 'Save changes', exact: true } )
	).toBeDisabled();
	await expect(
		page.getByLabel( 'IP addresses', { exact: true } )
	).toHaveAttribute( 'aria-invalid', 'true' );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await settings( page, { strict_cache_mode: false } );
} );
