const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );

for ( const width of [ 1280, 782 ] ) {
	test( `Google Analytics supports snippets and advanced settings at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			ga4_enabled: false,
			ga4_ids: [],
			ga4_server_url: '',
			google_data_layer: 'pixelpairDataLayer',
			ga4_debug: false,
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
		} );
		await page.goto(
			'/wp-admin/admin.php?page=pixelpair#/connections/ga4'
		);
		await expect(
			page.getByRole( 'heading', { name: 'Google Analytics', level: 1 } )
		).toBeFocused();
		await expect(
			page.getByLabel( 'Server container URL', { exact: true } )
		).toBeHidden();
		await page
			.getByLabel( 'Measurement IDs', { exact: true } )
			.fill( "<script>gtag('config', 'G-ABC12345');</script>" );
		await expect(
			page.getByLabel( 'Measurement IDs', { exact: true } )
		).toHaveValue( 'G-ABC12345' );
		await expect(
			page
				.locator( '.pixelpair-feedback' )
				.filter( { hasText: 'We found G-ABC12345' } )
		).toBeVisible();
		await page
			.getByLabel( 'Track visits and events', { exact: true } )
			.check();
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await page
			.getByRole( 'button', { name: 'Check connection', exact: true } )
			.click();
		await expect(
			page
				.locator( '.pixelpair-feedback' )
				.filter( { hasText: 'Browser tracking is configured.' } )
		).toBeVisible();
		await captureScreen( page, 'google-analytics', width );
		const advanced = page.getByText( 'Advanced', { exact: true } );
		await advanced.focus();
		await page.keyboard.press( 'Enter' );
		await page
			.getByLabel( 'Server container URL', { exact: true } )
			.fill( 'https://user:password@example.test/?key=bad' );
		await expect(
			page.getByRole( 'button', { name: 'Save changes', exact: true } )
		).toBeDisabled();
		await page
			.getByLabel( 'Server container URL', { exact: true } )
			.fill( 'https://metrics.example.test/' );
		await page
			.getByLabel( 'Data layer name', { exact: true } )
			.fill( 'shopDataLayer' );
		await page.getByLabel( 'Debug mode', { exact: true } ).check();
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await expect(
			page.getByLabel( 'Server container URL', { exact: true } )
		).toHaveValue( 'https://metrics.example.test' );
		await captureScreen( page, 'google-analytics-advanced', width );
		const saved = await page.evaluate( async () =>
			(
				await fetch( window.pixelpairAdmin.settingsUrl, {
					headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
				} )
			).json()
		);
		expect( saved.ga4_ids ).toEqual( [ 'G-ABC12345' ] );
		expect( saved.ga4_debug ).toBe( true );
		expect( saved.google_data_layer ).toBe( 'shopDataLayer' );
		expect( saved.meta_enabled ).toBe( true );
		await settings( page, {
			onboarding_complete: true,
			ga4_ids: [],
			ga4_debug: false,
			ga4_server_url: '',
			google_data_layer: 'pixelpairDataLayer',
		} );
	} );
}
