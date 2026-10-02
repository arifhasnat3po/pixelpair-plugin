const { test, expect } = require( '@playwright/test' );
const fs = require( 'node:fs' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
for ( const width of [ 1280, 782 ] ) {
	test( `Tag Manager supports existing containers and a safe template at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			gtm_enabled: false,
			gtm_id: '',
			gtm_server_url: '',
			gtm_data_layer: 'pixelpairDataLayer',
			gtm_data_layer_only: false,
		} );
		await page.goto(
			'/wp-admin/admin.php?page=pixelpair#/connections/gtm'
		);
		await expect(
			page.getByRole( 'heading', { name: 'Tag Manager', level: 1 } )
		).toBeFocused();
		await page
			.getByLabel( 'Container ID', { exact: true } )
			.fill(
				"<script src='https://www.googletagmanager.com/gtm.js?id=GTM-ABC12345'></script>"
			);
		await expect(
			page.getByLabel( 'Container ID', { exact: true } )
		).toHaveValue( 'GTM-ABC12345' );
		await page
			.getByLabel( 'Track visits and events', { exact: true } )
			.check();
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await captureScreen( page, 'tag-manager', width );
		const advanced = page.getByText( 'Advanced', { exact: true } );
		await advanced.focus();
		await page.keyboard.press( 'Enter' );
		await page
			.getByLabel( 'Use a container loaded by another plugin', {
				exact: true,
			} )
			.check();
		await page.getByLabel( 'Container ID', { exact: true } ).fill( '' );
		await page
			.getByLabel( 'Data layer name', { exact: true } )
			.fill( 'existingLayer' );
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect(
			page
				.locator( '.pixelpair-status' )
				.filter( { hasText: 'Data layer configured' } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Check connection', exact: true } )
			.click();
		await expect(
			page
				.locator( '.pixelpair-feedback' )
				.filter( { hasText: 'Data layer events are configured.' } )
		).toBeVisible();
		const ready = page.waitForEvent( 'download' );
		await page
			.getByRole( 'button', {
				name: 'Download container template',
				exact: true,
			} )
			.click();
		const download = await ready;
		expect( download.suggestedFilename() ).toBe( 'pixelpair-gtm.json' );
		const content = fs.readFileSync( await download.path(), 'utf8' );
		expect( JSON.parse( content ) ).toBeTruthy();
		expect( content ).toContain( 'G-REPLACE_ME' );
		expect( content ).not.toContain( 'access_token' );
		await captureScreen( page, 'tag-manager-advanced', width );
		await settings( page, {
			onboarding_complete: true,
			gtm_id: '',
			gtm_data_layer: 'pixelpairDataLayer',
			gtm_data_layer_only: false,
		} );
	} );
}
