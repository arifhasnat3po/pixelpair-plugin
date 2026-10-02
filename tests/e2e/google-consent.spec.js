const { test, expect } = require( '@playwright/test' );
const { login, settings, visitorOptions } = require( './fixtures/wordpress' );
for ( const strict of [ false, true ] ) {
	test(
		'Google category consent and mixed visitors in ' +
			( strict ? 'strict' : 'fast' ) +
			' mode',
		async ( { page, browser, baseURL } ) => {
			await login( page );
			await settings( page, {
				ga4_enabled: true,
				ga4_ids: [ 'G-ABC123', 'G-XYZ789' ],
				google_data_layer: 'analyticsLayer',
				gtm_enabled: true,
				gtm_id: 'GTM-ABC123',
				gtm_data_layer: 'tagsLayer',
				strict_cache_mode: strict,
				excluded_roles: [ 'subscriber' ],
			} );
			const context = await browser.newContext( {
				baseURL,
				...visitorOptions,
			} );
			let scripts = 0;
			let releaseLoader;
			const loaderReady = new Promise( ( resolve ) => {
				releaseLoader = resolve;
			} );
			await context.route(
				'https://www.googletagmanager.com/**',
				async ( route ) => {
					scripts++;
					await loaderReady;
					return route.fulfill( {
						contentType: 'application/javascript',
						body: '/* intercepted official Google loader */',
					} );
				}
			);
			await context.addInitScript( () => {
				window.Cookiebot = {
					hasResponse: true,
					consent: { marketing: false, statistics: false },
				};
			} );
			try {
				const visitor = await context.newPage();
				await visitor.goto( '/' );
				await visitor.waitForTimeout( 150 );
				expect( scripts ).toBe( 0 );
				await visitor.evaluate( () => {
					window.Cookiebot.consent.statistics = true;
					window.dispatchEvent( new Event( 'CookiebotOnAccept' ) );
				} );
				await expect.poll( () => scripts ).toBe( 1 );
				// A requested SDK has not necessarily loaded; hold it to reproduce that race.
				expect(
					await visitor.evaluate(
						() =>
							window.analyticsLayer.filter(
								( x ) => x[ 0 ] === 'config'
							).length
					)
				).toBe( 0 );
				releaseLoader();
				await expect
					.poll( () =>
						visitor.evaluate(
							() =>
								window.analyticsLayer.filter(
									( x ) => x[ 0 ] === 'config'
								).length
						)
					)
					.toBe( 2 );
				expect(
					await visitor.evaluate( () => window.tagsLayer )
				).toBeUndefined();
				await visitor.evaluate( () => {
					window.Cookiebot.consent.marketing = true;
					window.dispatchEvent( new Event( 'CookiebotOnAccept' ) );
				} );
				await expect.poll( () => scripts ).toBe( 2 );
				await expect
					.poll( () =>
						visitor.evaluate(
							() =>
								window.analyticsLayer.filter(
									( x ) =>
										x[ 0 ] === 'event' &&
										x[ 1 ] === 'page_view'
								).length
						)
					)
					.toBe( 1 );
				await expect
					.poll( () =>
						visitor.evaluate(
							() =>
								window.tagsLayer.filter(
									( x ) => x.event === 'pixelpair_page_view'
								).length
						)
					)
					.toBe( 1 );
				await visitor.evaluate( () => {
					window.Cookiebot.consent.statistics = false;
					window.dispatchEvent( new Event( 'CookiebotOnDecline' ) );
				} );
				expect(
					await visitor.evaluate(
						() =>
							window.analyticsLayer
								.filter( ( x ) => x[ 0 ] === 'consent' )
								.at( -1 )[ 2 ].analytics_storage
					)
				).toBe( 'denied' );
				await login( visitor, 'subscriber' );
				const before = scripts;
				await visitor.goto( '/' );
				await visitor.waitForTimeout( 150 );
				expect( scripts ).toBe( before );
			} finally {
				releaseLoader();
				await context.close();
				await settings( page );
			}
		}
	);
}

test( 'GTM export requires authentication and contains a placeholder, not secrets', async ( {
	page,
} ) => {
	await login( page );
	await settings( page );
	const data = await page.evaluate( async () => {
		const url = new URL( window.pixelpairAdmin.settingsUrl );
		if ( url.searchParams.has( 'rest_route' ) ) {
			url.searchParams.set( 'rest_route', '/pixelpair/v1/gtm-export' );
		} else {
			url.pathname = url.pathname.replace( '/settings', '/gtm-export' );
		}
		const response = await fetch( url, {
			headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
		} );
		return response.json();
	} );
	expect( data.exportFormatVersion ).toBe( 2 );
	expect( JSON.stringify( data ) ).toContain( 'G-REPLACE_ME' );
	expect( data.containerVersion.tag ).toHaveLength( 11 );
} );
