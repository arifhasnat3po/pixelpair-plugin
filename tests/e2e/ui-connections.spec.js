const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

for ( const width of [ 1280, 782 ] ) {
	test( `Connections has one clear action per platform at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
			meta_capi_enabled: true,
		} );
		await page
			.locator( '.pixelpair-app' )
			.getByRole( 'link', { name: 'Connections', exact: true } )
			.click();
		await expect(
			page.getByRole( 'button', { name: 'Fix Meta', exact: true } )
		).toBeVisible();
		await expect( page.locator( '.pixelpair-connections li' ) ).toHaveCount(
			4
		);
		await expect(
			page.locator( '.pixelpair-connections button' )
		).toHaveCount( 4 );
		await page.addScriptTag( {
			path: require.resolve( 'axe-core/axe.min.js' ),
		} );
		const violations = await page.evaluate( async () =>
			( await window.axe.run( '.pixelpair-app' ) ).violations.filter(
				( issue ) => [ 'serious', 'critical' ].includes( issue.impact )
			)
		);
		expect( violations ).toEqual( [] );
		await page.screenshot( {
			path: test.info().outputPath( `connections-${ width }.png` ),
			fullPage: true,
		} );
		await page
			.getByRole( 'button', { name: 'Fix Meta', exact: true } )
			.click();
		await expect( page ).toHaveURL( /#\/connections\/meta$/ );
		await expect(
			page.getByLabel( 'Pixel ID', { exact: true } )
		).toBeVisible();
	} );
}
