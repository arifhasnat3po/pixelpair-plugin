const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { restRoute } = require( './fixtures/rest' );

test( 'cancelling Back preserves the destination for the next Back and Forward', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: true } );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/overview' );
	const nav = page.locator( '.pixelpair-nav' );
	await nav.getByRole( 'link', { name: 'Connections', exact: true } ).click();
	await nav.getByRole( 'link', { name: 'Privacy', exact: true } ).click();
	await page
		.getByLabel( 'IP addresses', { exact: true } )
		.fill( '192.0.2.50' );
	await page.goBack();
	await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( page ).toHaveURL( /#\/privacy$/ );
	await page.goBack();
	await page
		.getByRole( 'button', { name: 'Discard changes', exact: true } )
		.click();
	await expect( page ).toHaveURL( /#\/connections$/ );
	await expect(
		page.getByRole( 'heading', { name: 'Connections', level: 1 } )
	).toBeFocused();
	await page.goForward();
	await expect(
		page.getByRole( 'heading', { name: 'Privacy', level: 1 } )
	).toBeFocused();
	await expect(
		page.getByLabel( 'IP addresses', { exact: true } )
	).toHaveValue( '' );
} );

test( 'discarding a failed save clears its error when navigating forward and back', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: true } );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/connections/meta' );
	await page
		.getByLabel( 'Pixel ID', { exact: true } )
		.fill( '123456789012345' );
	await page.route( restRoute( '/pixelpair/v1/settings' ), ( route ) =>
		route.request().method() === 'POST'
			? route.fulfill( {
					status: 500,
					json: { message: 'Meta save failed for this test.' },
				} )
			: route.continue()
	);
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect( page.getByRole( 'alert' ) ).toContainText(
		'Meta save failed'
	);
	await page
		.locator( '.pixelpair-nav' )
		.getByRole( 'link', { name: 'Privacy', exact: true } )
		.click();
	await page
		.getByRole( 'button', { name: 'Discard changes', exact: true } )
		.click();
	await expect(
		page.getByRole( 'heading', { name: 'Privacy', level: 1 } )
	).toBeFocused();
	await expect( page.locator( '.pixelpair-app' ) ).not.toContainText(
		'Meta save failed'
	);
	await page.goBack();
	await expect(
		page.getByRole( 'heading', { name: 'Meta', level: 1 } )
	).toBeFocused();
	await expect( page.locator( '.pixelpair-app' ) ).not.toContainText(
		'Meta save failed'
	);
} );

test( 'WordPress submenu routes remain in the app with dirty-change protection', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: true } );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/connections/meta' );
	await page
		.getByLabel( 'Pixel ID', { exact: true } )
		.fill( '123456789012345' );
	const menu = page.locator( '#toplevel_page_pixelpair .wp-submenu' );
	await expect(
		menu.getByRole( 'link', { name: 'Store', exact: true } )
	).toHaveCount( 0 );
	await menu.getByRole( 'link', { name: 'Privacy', exact: true } ).click();
	await expect(
		page.getByRole( 'dialog', { name: 'Discard unsaved changes?' } )
	).toBeVisible();
	await page
		.getByRole( 'button', { name: 'Discard changes', exact: true } )
		.click();
	await expect(
		page.getByRole( 'heading', { name: 'Privacy', level: 1 } )
	).toBeFocused();
	await expect(
		menu.getByRole( 'link', { name: 'Privacy', exact: true } )
	).toHaveAttribute( 'aria-current', 'page' );
} );
