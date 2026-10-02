const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `Privacy validates IP exclusions and saves one owned patch at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			excluded_roles: [ 'editor' ],
			excluded_ips: [],
		} );
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/privacy' );
		await expect(
			page.getByRole( 'heading', { name: 'Privacy', level: 1 } )
		).toBeFocused();
		await expect(
			page.getByLabel( 'Editor', { exact: true } )
		).toBeChecked();
		await page
			.getByLabel( 'IP addresses', { exact: true } )
			.fill( '192.0.2.1/999' );
		await expect(
			page.getByRole( 'button', { name: 'Save changes', exact: true } )
		).toBeDisabled();
		await page
			.getByLabel( 'IP addresses', { exact: true } )
			.fill( '192.0.2.15\n2001:db8::/32' );
		await page.getByLabel( 'Administrator', { exact: true } ).check();
		const response = page.waitForResponse(
			( r ) =>
				restRoute( '/pixelpair/v1/settings' )( new URL( r.url() ) ) &&
				r.request().method() === 'POST'
		);
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		const result = await response;
		expect( result.request().postDataJSON() ).toEqual( {
			excluded_roles: [ 'editor', 'administrator' ],
			excluded_ips: [ '192.0.2.15', '2001:db8::/32' ],
		} );
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await page.reload();
		await expect(
			page.getByLabel( 'IP addresses', { exact: true } )
		).toHaveValue( '192.0.2.15\n2001:db8::/32' );
		await captureScreen( page, 'privacy', width );
		await page.getByText( 'Advanced', { exact: true } ).focus();
		await page.keyboard.press( 'Enter' );
		await captureScreen( page, 'privacy-advanced', width );
		await settings( page, { excluded_roles: [], excluded_ips: [] } );
	} );
}
