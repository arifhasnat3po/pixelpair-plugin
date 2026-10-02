const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `AI access recovers from failed reads and blocked copying at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		await page.route(
			restRoute( '/pixelpair/v1/ai-status' ),
			( route ) =>
				route.fulfill( {
					status: 503,
					json: { message: 'Connection details could not load.' },
				} ),
			{ times: 1 }
		);
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/settings/ai' );
		await expect(
			page.getByRole( 'heading', { name: 'AI access', level: 1 } )
		).toBeFocused();
		await expect( page.getByRole( 'alert' ) ).toContainText(
			'Connection details could not load.'
		);
		await page
			.getByRole( 'button', { name: 'Retry', exact: true } )
			.click();
		await expect(
			page.getByLabel( 'MCP endpoint', { exact: true } )
		).toBeVisible();
		await expect(
			page.getByText(
				'Install and activate the official WordPress MCP Adapter.',
				{ exact: false }
			)
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Copy connection details' } )
		).toBeDisabled();
		await captureScreen( page, 'ai-setup-needed', width );
		await page.route( restRoute( '/pixelpair/v1/ai-status' ), ( route ) =>
			route.fulfill( {
				json: {
					abilities: true,
					adapter: true,
					https: true,
					endpoint: 'https://example.test/wp-json/pixelpair/mcp',
					site_id: 1,
					profile_url:
						'/wp-admin/profile.php#application-passwords-section',
				},
			} )
		);
		await page.reload();
		await expect( page.locator( '.pixelpair-status' ) ).toContainText(
			'AI connection available'
		);
		await page.evaluate( () =>
			Object.defineProperty( navigator, 'clipboard', {
				configurable: true,
				value: {
					writeText: async () => {
						throw new Error( 'Denied' );
					},
				},
			} )
		);
		await page
			.getByRole( 'button', { name: 'Copy connection details' } )
			.click();
		await expect( page.getByRole( 'alert' ) ).toContainText(
			'Copy was blocked.'
		);
		await expect(
			page.getByLabel( 'MCP endpoint', { exact: true } )
		).toHaveValue( 'https://example.test/wp-json/pixelpair/mcp' );
		await page.evaluate( () =>
			Object.defineProperty( navigator, 'clipboard', {
				configurable: true,
				value: {
					writeText: async ( text ) => {
						window.copiedDetails = text;
					},
				},
			} )
		);
		await page
			.getByRole( 'button', { name: 'Copy connection details' } )
			.click();
		await expect( page.getByRole( 'status' ) ).toContainText(
			'Connection details copied'
		);
		expect( await page.evaluate( () => window.copiedDetails ) ).toBe(
			'Endpoint: https://example.test/wp-json/pixelpair/mcp\nSite ID: 1'
		);
		await captureScreen( page, 'ai', width );
		await page.getByText( 'Advanced', { exact: true } ).click();
		await captureScreen( page, 'ai-advanced', width );
		await page.getByRole( 'button', { name: 'Back to Settings' } ).click();
		await expect(
			page.getByRole( 'heading', { name: 'Settings', level: 1 } )
		).toBeFocused();
	} );
}
