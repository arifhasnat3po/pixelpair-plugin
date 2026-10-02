const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

test.setTimeout( 90000 );
for ( const scheme of [ 'light', 'coffee' ] ) {
	for ( const width of [ 1280, 782 ] ) {
		test( `brand placement and visual baseline at ${ width } in ${ scheme }`, async ( {
			page,
		} ) => {
			const consoleMessages = [];
			page.on( 'console', ( message ) =>
				consoleMessages.push( message.text() )
			);
			await page.setViewportSize( { width, height: 900 } );
			await login( page );
			await page.goto( '/wp-admin/profile.php' );
			await page
				.locator( `input[name="admin_color"][value="${ scheme }"]` )
				.check();
			await page.locator( '#submit' ).click();
			await settings( page, { onboarding_complete: true } );
			await page.reload();
			const logo = page.locator( '.pixelpair-brand' );
			await expect( logo ).toBeVisible();
			await expect( logo ).toHaveAttribute( 'alt', 'PixelPair' );
			await expect( logo ).toHaveScreenshot(
				`overview-${ scheme }-${ width }.png`,
				{ maxDiffPixelRatio: 0.01 }
			);
			const icon = page.locator(
				'#toplevel_page_pixelpair .wp-menu-image'
			);
			// eslint-disable-next-line playwright/no-conditional-in-test -- The mobile viewport uses WordPress's menu drawer.
			if ( width === 782 ) {
				await page.locator( '#wp-admin-bar-menu-toggle a' ).click();
			}
			await expect( icon ).toBeVisible();
			await expect( icon ).toHaveScreenshot(
				`menu-${ scheme }-${ width }.png`,
				{ maxDiffPixelRatio: 0.01 }
			);
			await page.screenshot( {
				path: test
					.info()
					.outputPath( `overview-${ scheme }-${ width }.png` ),
				fullPage: true,
			} );
			// eslint-disable-next-line playwright/no-conditional-in-test -- Restore the mobile drawer after inspecting its icon.
			if ( width === 782 ) {
				await page.locator( '#wp-admin-bar-menu-toggle a' ).click();
			}
			await expect( page.locator( '#footer-left' ) ).toContainText(
				'PixelPair, built by Arif Hasnat'
			);
			await page
				.getByRole( 'button', { name: 'Run setup again' } )
				.click();
			await expect( logo ).toBeVisible();
			await page
				.getByLabel( 'Facebook and Instagram ads (Meta)' )
				.check();
			await page
				.getByRole( 'button', { name: 'Continue', exact: true } )
				.click();
			await expect( logo ).toHaveCount( 0 );
			await page
				.locator( '.pixelpair-nav' )
				.getByRole( 'link', { name: 'Settings', exact: true } )
				.click();
			await page
				.getByRole( 'button', { name: 'Discard changes', exact: true } )
				.click();
			await expect(
				page.getByRole( 'heading', { name: 'About', exact: true } )
			).toBeVisible();
			await expect(
				page.locator( '.pixelpair-section' ).filter( {
					has: page.getByRole( 'heading', {
						name: 'About',
						exact: true,
					} ),
				} )
			).toContainText( 'Built by Arif Hasnat' );
			await expect( logo ).toHaveCount( 0 );
			await page.goto( '/wp-admin/index.php' );
			await expect( page.locator( '#footer-left' ) ).not.toContainText(
				'Arif Hasnat'
			);
			consoleMessages.length = 0;
			await page.goto( '/' );
			expect( await page.content() ).not.toContain( 'Arif Hasnat' );
			expect( consoleMessages.join( '\n' ) ).not.toContain(
				'Arif Hasnat'
			);
			await expect( page.locator( 'body' ) ).not.toContainText(
				'Arif Hasnat'
			);
			await expect(
				page.locator( 'img[src*="pixelpair-logo"]' )
			).toHaveCount( 0 );
		} );
	}
}
