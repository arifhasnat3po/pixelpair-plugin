const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

test( 'onboarding saves IDs, excludes admins and supports secret-free configuration import', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: false } );
	await page.reload();
	await page
		.locator( '.pixelpair-app' )
		.getByRole( 'link', { name: 'Overview', exact: true } )
		.click();
	await page
		.getByRole( 'checkbox', {
			name: 'Facebook and Instagram ads (Meta)',
			exact: true,
		} )
		.check();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page
		.getByRole( 'textbox', { name: 'Meta Pixel ID', exact: true } )
		.fill( '123456789012345' );
	await page.getByRole( 'button', { name: 'Save and continue' } ).click();
	await expect(
		page.getByRole( 'heading', { name: 'Check it works', level: 1 } )
	).toBeVisible();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page
		.getByRole( 'checkbox', {
			name: 'Don’t track my visits while I’m logged in',
		} )
		.check();
	await page.getByRole( 'button', { name: 'Finish setup' } ).click();
	await expect(
		page.getByRole( 'button', { name: 'Run setup again' } )
	).toBeVisible();
	await page
		.locator( '.pixelpair-nav' )
		.getByRole( 'link', { name: 'Settings', exact: true } )
		.click();
	await page.getByText( 'Import and export', { exact: true } ).click();
	const downloadPromise = page.waitForEvent( 'download' );
	await page
		.getByRole( 'button', { name: 'Download settings JSON' } )
		.click();
	const download = await downloadPromise;
	expect( download.suggestedFilename() ).toBe( 'pixelpair-settings.json' );
	const exported = await page.evaluate( async () => {
		const r = await fetch(
			window.pixelpairAdmin.settingsUrl.replace(
				'/settings',
				'/transfer'
			),
			{ headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce } }
		);
		return r.json();
	} );
	expect( exported.settings.excluded_roles ).toContain( 'administrator' );
	expect( Object.keys( exported ) ).toEqual( [
		'format',
		'version',
		'settings',
		'events',
	] );
	expect( JSON.stringify( exported ) ).not.toContain( 'access_token' );
	exported.settings.strict_cache_mode = true;
	await page
		.getByLabel( 'Import JSON preview' )
		.fill( JSON.stringify( exported ) );
	await page.getByRole( 'button', { name: 'Review import' } ).click();
	await page.getByRole( 'button', { name: 'Confirm import' } ).click();
	await expect(
		page
			.locator( '.pixelpair-app' )
			.getByText( 'Configuration imported. Purge your page cache.', {
				exact: true,
			} )
	).toBeVisible();
	await settings( page, { onboarding_complete: true } );
} );
