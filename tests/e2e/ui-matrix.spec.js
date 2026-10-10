const { test, expect } = require( '@playwright/test' );
const { writeFileSync } = require( 'node:fs' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
test.setTimeout( 180000 );
const routes = [
	'overview',
	'connections',
	'connections/meta',
	'connections/ga4',
	'connections/gtm',
	'connections/tiktok',
	'events',
	'events/automatic/form_submit',
	'events/data',
	'events/custom',
	'events/custom/new',
	'privacy',
	'activity',
	'settings',
	'settings/ai',
	'setup',
];
for ( const scheme of [ 'light', 'coffee' ] ) {
	for ( const width of [ 1280, 782, 600 ] ) {
		for ( const direction of [ 'ltr', 'rtl' ] ) {
			test( `all screens at ${ width } in ${ scheme } ${ direction }`, async ( {
				page,
			} ) => {
				await page.addInitScript( () => {
					const observer = new window.MutationObserver( () => {
						if (
							document.querySelector( '.pixelpair-page h1' ) &&
							! document.querySelector( '.pixelpair-skeleton' )
						) {
							window.pixelpairReadyMs = performance.now();
							observer.disconnect();
						}
					} );
					observer.observe( document, {
						childList: true,
						subtree: true,
					} );
				} );
				await page.setViewportSize( { width, height: 900 } );
				await login( page );
				await page.goto( '/wp-admin/profile.php' );
				await page
					.locator( `input[name="admin_color"][value="${ scheme }"]` )
					.check();
				await page.locator( '#submit' ).click();
				await settings( page, { onboarding_complete: true } );
				const timings = [];
				const screenRoutes =
					process.env.PIXELPAIR_TEST_STORES === '1'
						? [ 'store/woocommerce', 'store/edd' ]
						: routes;
				for ( const route of screenRoutes ) {
					const started = Date.now();
					await page.goto(
						`/wp-admin/admin.php?page=pixelpair#/${ route }`
					);
					await page.evaluate( ( dir ) => {
						document
							.querySelector( '.pixelpair-app' )
							.setAttribute( 'dir', dir );
					}, direction );
					await expect(
						page.locator( '.pixelpair-page h1' )
					).toBeFocused();
					await expect(
						page.locator( '.pixelpair-app' )
					).toHaveAttribute( 'data-route', route );
					await expect(
						page.locator( '.pixelpair-skeleton' )
					).toHaveCount( 0 );
					const routeMs = Date.now() - started;
					await expect(
						page.locator( '.pixelpair-page' )
					).not.toContainText( 'This screen could not load' );
					await captureScreen(
						page,
						`${ route.replaceAll( '/', '-' ) }-${ scheme }-${ direction }`,
						width
					);
					const primary = page.locator(
						'.pixelpair-app .pixelpair-button--primary:visible'
					);
					expect( await primary.count() ).toBeLessThanOrEqual( 1 );
					await page.locator( '.pixelpair-page h1' ).focus();
					await page.keyboard.press( 'Tab' );
					expect(
						await page
							.locator( '.pixelpair-app' )
							.evaluate( ( app ) =>
								app.contains( app.ownerDocument.activeElement )
							)
					).toBe( true );
					timings.push( {
						route,
						routeMs,
						initialDocumentReadyMs: await page.evaluate(
							() => window.pixelpairReadyMs
						),
						domReadyMs: await page.evaluate(
							() =>
								performance.getEntriesByType(
									'navigation'
								)[ 0 ].domContentLoadedEventEnd
						),
					} );
				}
				writeFileSync(
					test.info().outputPath( 'render-timing.json' ),
					JSON.stringify( timings, null, 2 )
				);
			} );
		}
	}
}
