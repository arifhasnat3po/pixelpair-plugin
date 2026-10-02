const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `WooCommerce keeps drafts, validates advanced values and saves its own settings at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		const original = await page.evaluate( async () =>
			(
				await fetch( window.pixelpairAdmin.settingsUrl, {
					headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
				} )
			).json()
		);
		try {
			await page.goto(
				'/wp-admin/admin.php?page=pixelpair#/store/woocommerce'
			);
			await expect(
				page.getByRole( 'heading', { name: 'WooCommerce', level: 1 } )
			).toBeFocused();
			await expect(
				page.getByLabel( 'Product ID prefix', { exact: true } )
			).toBeHidden();
			await page
				.getByLabel( 'Track store events', { exact: true } )
				.check();
			await page
				.getByLabel( 'Product IDs', { exact: true } )
				.selectOption( 'sku' );
			await page.getByLabel( 'Purchases', { exact: true } ).uncheck();
			await page.route(
				restRoute( '/pixelpair/v1/settings' ),
				( route ) =>
					route.fulfill( {
						status: 500,
						contentType: 'application/json',
						body: JSON.stringify( {
							message:
								'Store settings could not be saved. Try again.',
						} ),
					} ),
				{ times: 1 }
			);
			await page
				.getByRole( 'button', { name: 'Save changes', exact: true } )
				.click();
			await expect(
				page.locator( '.pixelpair-feedback[role="alert"]' )
			).toContainText( 'Store settings could not be saved.' );
			await expect(
				page.getByLabel( 'Product IDs', { exact: true } )
			).toHaveValue( 'sku' );
			await page
				.getByRole( 'button', { name: 'Save changes', exact: true } )
				.click();
			await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount(
				0
			);
			await captureScreen( page, 'store-woocommerce', width );
			await page.getByText( 'Advanced', { exact: true } ).focus();
			await page.keyboard.press( 'Enter' );
			await page
				.getByLabel( 'Product ID prefix', { exact: true } )
				.fill( 'invalid prefix' );
			await expect(
				page.getByRole( 'button', {
					name: 'Save changes',
					exact: true,
				} )
			).toBeDisabled();
			await page
				.getByLabel( 'Product ID prefix', { exact: true } )
				.fill( 'catalog_' );
			await page
				.getByLabel( 'Product-list limit', { exact: true } )
				.fill( '201' );
			await expect(
				page.getByRole( 'button', {
					name: 'Save changes',
					exact: true,
				} )
			).toBeDisabled();
			await page
				.getByLabel( 'Product-list limit', { exact: true } )
				.fill( '12' );
			await page
				.getByRole( 'button', { name: 'Save changes', exact: true } )
				.click();
			await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount(
				0
			);
			await captureScreen( page, 'store-woocommerce-advanced', width );
			const stored = await page.evaluate( async () =>
				(
					await fetch( window.pixelpairAdmin.settingsUrl, {
						headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
					} )
				).json()
			);
			expect( stored.woocommerce ).toMatchObject( {
				enabled: true,
				content_id: 'sku',
				id_prefix: 'catalog_',
				list_limit: 12,
				events: { purchase: false, refund: false },
			} );
			expect( stored.edd ).toEqual( original.edd );
		} finally {
			await settings( page, {
				woocommerce: original.woocommerce,
				edd: original.edd,
			} );
		}
	} );
}
