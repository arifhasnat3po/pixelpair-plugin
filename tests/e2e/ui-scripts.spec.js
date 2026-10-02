const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `Scripts preserve location drafts and recover from failed loads at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		await page.route(
			restRoute( '/pixelpair/v1/scripts' ),
			( route ) =>
				route.fulfill( {
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify( {
						message: 'Scripts could not be loaded. Try again.',
					} ),
				} ),
			{ times: 1 }
		);
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/scripts' );
		await expect(
			page
				.locator( '.pixelpair-feedback' )
				.getByText( 'Scripts could not be loaded. Try again.' )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Retry', exact: true } )
			.click();
		const field = page.getByLabel( 'HTML and scripts', { exact: true } );
		await expect( field ).toBeVisible();
		await captureScreen( page, 'scripts-head', width );
		await field.fill( '<!-- Draft only -->' );
		await page
			.getByRole( 'button', { name: 'Footer', exact: true } )
			.click();
		await field.fill( '<!-- Footer draft -->' );
		await captureScreen( page, 'scripts-footer-draft', width );
		await page.getByRole( 'button', { name: 'Head', exact: true } ).click();
		await expect( field ).toHaveValue( '<!-- Draft only -->' );
		await page.getByRole( 'button', { name: 'Clear this script' } ).click();
		await expect(
			page.getByRole( 'dialog', { name: 'Clear the Head script?' } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Cancel', exact: true } )
			.click();
		await expect( field ).toHaveValue( '<!-- Draft only -->' );
		await page
			.getByRole( 'button', { name: 'Discard', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await page
			.getByRole( 'button', { name: 'After body opens', exact: true } )
			.click();
		await captureScreen( page, 'scripts-body', width );
		await page
			.getByRole( 'button', { name: 'Paid receipt', exact: true } )
			.click();
		await captureScreen( page, 'scripts-receipt', width );
	} );
}
