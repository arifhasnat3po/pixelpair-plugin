const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

test( 'consent recommendation is scoped, resolves and stays dismissed', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		consent_notice_dismissed: false,
		onboarding_complete: true,
	} );
	await expect( page.locator( '.pixelpair-consent-notice' ) ).toBeVisible();
	for ( const screen of [ 'index.php', 'edit.php', 'profile.php' ] ) {
		await page.goto( `/wp-admin/${ screen }` );
		await expect( page.locator( '.pixelpair-consent-notice' ) ).toHaveCount(
			0
		);
		await expect(
			page.locator( 'script[id="pixelpair-admin-js"]' )
		).toHaveCount( 0 );
	}
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		deny_until_consent: true,
	} );
	await expect( page.locator( '.pixelpair-consent-notice' ) ).toHaveCount(
		0
	);
	await settings( page, {
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		deny_until_consent: false,
	} );
	await page
		.getByRole( 'button', { name: 'Dismiss recommendation' } )
		.click();
	await expect( page.locator( '.pixelpair-consent-notice' ) ).toHaveCount(
		0
	);
	await page.reload();
	await expect( page.locator( '.pixelpair-consent-notice' ) ).toHaveCount(
		0
	);
	await settings( page, { consent_notice_dismissed: false } );
	await expect( page.locator( '.pixelpair-consent-notice' ) ).toHaveCount(
		0
	);
} );
