const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
for ( const width of [ 1280, 782 ] ) {
	test( `TikTok masks credentials and explains a rejected token at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			tiktok_pixel_id: '',
			tiktok_advanced_matching: false,
		} );
		await page.evaluate( async () => {
			await fetch(
				window.pixelpairAdmin.settingsUrl.replace(
					'/settings',
					'/tiktok'
				),
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.pixelpairAdmin.nonce,
					},
					body: JSON.stringify( {
						remove_token: true,
						test_code: '',
					} ),
				}
			);
		} );
		await page.goto(
			'/wp-admin/admin.php?page=pixelpair#/connections/tiktok'
		);
		await expect(
			page.getByRole( 'heading', { name: 'TikTok', level: 1 } )
		).toBeFocused();
		await page
			.getByLabel( 'Pixel ID', { exact: true } )
			.fill( "ttq.load('ABCDEFGHIJKLMNOPQRST');" );
		await page
			.getByLabel( 'Track visits and events', { exact: true } )
			.check();
		await page
			.getByLabel( 'Send events from your server too', { exact: true } )
			.check();
		await page
			.getByLabel( 'Access token', { exact: true } )
			.fill( 'fake_tiktok_fixture_never_a_real_token' );
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect(
			page.getByText( 'Token saved', { exact: true } )
		).toBeVisible();
		expect( await page.content() ).not.toContain(
			'fake_tiktok_fixture_never_a_real_token'
		);
		await page
			.getByLabel( 'Test event code', { exact: true } )
			.fill( 'TEST_UI_ONLY' );
		await page.route(
			/pixelpair(?:%2F|\/)v1(?:%2F|\/)tiktok(?:%2F|\/)test/,
			( route ) =>
				route.fulfill( {
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify( {
						success: false,
						code: 401,
						response: { error_code: 401 },
					} ),
				} )
		);
		await page
			.getByRole( 'button', { name: 'Check connection', exact: true } )
			.click();
		await expect(
			page.locator( '.pixelpair-feedback[role="alert"]' )
		).toContainText( 'TikTok rejected the access token.' );
		await page
			.getByRole( 'button', { name: 'Turn off test mode', exact: true } )
			.click();
		await expect(
			page.getByRole( 'button', {
				name: 'Turn off test mode',
				exact: true,
			} )
		).toHaveCount( 0 );
		await expect(
			page.getByLabel( 'Test event code', { exact: true } )
		).toHaveValue( '' );
		await captureScreen( page, 'tiktok', width );
		await page
			.getByRole( 'button', { name: 'Replace token', exact: true } )
			.click();
		await page
			.getByLabel( 'Access token', { exact: true } )
			.fill( 'replacement_fixture_token' );
		await page
			.getByRole( 'button', { name: 'Discard', exact: true } )
			.click();
		await expect(
			page.getByText( 'Token saved', { exact: true } )
		).toBeVisible();
		await page.getByText( 'Advanced', { exact: true } ).click();
		await page
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await expect(
			page.getByRole( 'dialog', {
				name: 'Remove the TikTok access token?',
			} )
		).toBeVisible();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await expect(
			page.getByLabel( 'Access token', { exact: true } )
		).toBeVisible();
		await settings( page, {
			onboarding_complete: true,
			tiktok_pixel_id: '',
		} );
	} );
}
