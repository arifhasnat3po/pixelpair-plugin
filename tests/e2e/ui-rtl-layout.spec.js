const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

test( 'RTL checkboxes keep an eight-pixel gap before their labels at all widths', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: true } );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/privacy' );
	await expect(
		page.getByLabel( 'Wait for marketing consent', { exact: true } )
	).toBeVisible();
	await page
		.locator( '.pixelpair-app' )
		.evaluate( ( app ) => app.setAttribute( 'dir', 'rtl' ) );
	for ( const width of [ 600, 782, 1280 ] ) {
		await page.setViewportSize( { width, height: 900 } );
		const gaps = await page
			.locator( '.pixelpair-check:visible' )
			.evaluateAll( ( controls ) =>
				controls.map( ( control ) => {
					const input = control
						.querySelector( 'input' )
						.getBoundingClientRect();
					const label = control
						.querySelector( 'label' )
						.getBoundingClientRect();
					return input.left - label.right;
				} )
			);
		expect( Math.min( ...gaps ) ).toBeGreaterThanOrEqual( 8 );
	}
} );
