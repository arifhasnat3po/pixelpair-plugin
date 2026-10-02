const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `Settings save preferences and roles, review imports and provide working docs at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			logging_enabled: false,
		} );
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/settings' );
		const originalRoles = await page.evaluate( async () =>
			(
				await fetch(
					window.pixelpairAdmin.settingsUrl.replace(
						'/settings',
						'/permissions'
					),
					{ headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce } }
				)
			).json()
		);
		await expect(
			page.getByRole( 'heading', { name: 'Settings', level: 1 } )
		).toBeFocused();
		await captureScreen( page, 'settings', width );
		await page
			.getByLabel( 'Record server activity', { exact: true } )
			.check();
		await page
			.getByLabel( 'Keep logs for (days)', { exact: true } )
			.fill( '91' );
		await expect(
			page.getByRole( 'button', { name: 'Save changes', exact: true } )
		).toBeDisabled();
		await page
			.getByLabel( 'Keep logs for (days)', { exact: true } )
			.fill( '14' );
		await page.getByText( 'Permissions', { exact: true } ).click();
		await expect(
			page.getByLabel( 'Administrator', { exact: true } )
		).toBeDisabled();
		await page.getByLabel( 'Editor', { exact: true } ).check();
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await page.reload();
		await expect(
			page.getByLabel( 'Keep logs for (days)', { exact: true } )
		).toHaveValue( '14' );
		await page.getByText( 'Permissions', { exact: true } ).click();
		await expect(
			page.getByLabel( 'Editor', { exact: true } )
		).toBeChecked();
		await page.getByText( 'Advanced', { exact: true } ).click();
		const docs = await page
			.getByRole( 'link', { name: 'Documentation', exact: false } )
			.getAttribute( 'href' );
		const guide = await page.request.get( docs );
		expect( guide.status() ).toBe( 200 );
		expect( await guide.text() ).toContain(
			'Fast mode and Strict cache mode'
		);
		await captureScreen( page, 'settings-advanced', width );
		await page.getByText( 'Import and export', { exact: true } ).click();
		await page
			.getByLabel( 'Import JSON preview', { exact: true } )
			.fill( '{not JSON}' );
		await page
			.getByRole( 'button', { name: 'Review import', exact: true } )
			.click();
		await expect(
			page.locator( '.pixelpair-feedback[role="alert"]' )
		).toContainText( 'Choose a PixelPair version 1 export' );
		const exported = await page.evaluate( async () =>
			(
				await fetch(
					window.pixelpairAdmin.settingsUrl.replace(
						'/settings',
						'/transfer'
					),
					{ headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce } }
				)
			).json()
		);
		expect( Object.keys( exported ) ).toEqual( [
			'format',
			'version',
			'settings',
			'events',
		] );
		expect( JSON.stringify( exported ) ).not.toContain( 'access_token' );
		await page
			.getByLabel( 'Import JSON preview', { exact: true } )
			.fill( JSON.stringify( exported, null, 2 ) );
		await captureScreen( page, 'settings-transfer', width );
		await page
			.getByRole( 'button', { name: 'Review import', exact: true } )
			.click();
		await expect(
			page.getByRole( 'dialog', {
				name: 'Replace settings and custom events?',
			} )
		).toBeVisible();
		await page.route(
			restRoute( '/pixelpair/v1/transfer' ),
			( route ) =>
				route.fulfill( {
					status: 400,
					json: {
						message: 'Import rejected. No changes were saved.',
					},
				} ),
			{ times: 1 }
		);
		await page
			.getByRole( 'button', { name: 'Confirm import', exact: true } )
			.click();
		await expect( page.getByRole( 'dialog' ) ).toContainText(
			'Import rejected.'
		);
		await captureScreen( page, 'settings-import-error', width );
		await page
			.getByRole( 'button', { name: 'Confirm import', exact: true } )
			.click();
		await expect(
			page.locator( '.pixelpair-feedback[role="status"]' )
		).toContainText( 'Configuration imported.' );
		await expect(
			page.getByLabel( 'Import JSON preview', { exact: true } )
		).toHaveValue( '' );
		await page.evaluate(
			async ( roles ) =>
				fetch(
					window.pixelpairAdmin.settingsUrl.replace(
						'/settings',
						'/permissions'
					),
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': window.pixelpairAdmin.nonce,
						},
						body: JSON.stringify( roles ),
					}
				),
			originalRoles
		);
		await settings( page, { onboarding_complete: true } );
	} );
}
