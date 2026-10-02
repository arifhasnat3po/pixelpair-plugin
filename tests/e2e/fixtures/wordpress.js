const { expect } = require( '@playwright/test' );

/**
 * Sign in to a disposable wp-env site using its seeded users.
 *
 * @param {import('@playwright/test').Page} page     Browser page.
 * @param {string}                          username Seeded user name.
 */
async function login( page, username = 'admin' ) {
	await page.goto( '/wp-login.php' );
	// WordPress focuses this field after a timer; wait before entering the password.
	await expect(
		page.getByLabel( 'Username or Email Address' )
	).toBeFocused();
	await page.getByLabel( 'Username or Email Address' ).fill( username );
	await page.locator( '#user_pass' ).fill( 'password' );
	await page.getByRole( 'button', { name: 'Log In', exact: true } ).click();
	await expect
		.poll( async () =>
			( await page.context().cookies() ).some( ( cookie ) =>
				cookie.name.startsWith( 'wordpress_logged_in_' )
			)
		)
		.toBe( true );
}

/**
 * Save settings through the real authenticated REST route.
 *
 * @param {import('@playwright/test').Page} page    Authorized admin page.
 * @param {Object}                          changes Settings changes.
 */
async function settings( page, changes = {} ) {
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/connections/meta' );
	await expect(
		page.getByLabel( 'Pixel ID', { exact: true } )
	).toBeVisible();
	const result = await page.evaluate(
		async ( data ) => {
			const response = await fetch( window.pixelpairAdmin.settingsUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.pixelpairAdmin.nonce,
				},
				body: JSON.stringify( data ),
			} );
			return { status: response.status, data: await response.json() };
		},
		{
			meta_enabled: false,
			tiktok_enabled: false,
			tiktok_capi_enabled: false,
			ga4_enabled: false,
			gtm_enabled: false,
			google_consent_denied: false,
			meta_pixel_id: '',
			meta_capi_enabled: false,
			meta_advanced_matching: false,
			meta_ldu: false,
			meta_sensitive_data: false,
			trust_proxy: false,
			excluded_roles: [],
			excluded_ips: [],
			exclude_bots: true,
			strict_cache_mode: false,
			deny_until_consent: false,
			...changes,
		}
	);
	expect( result.status, JSON.stringify( result.data ) ).toBe( 200 );
	await page.reload();
	await expect( page.getByLabel( 'Pixel ID', { exact: true } ) ).toHaveValue(
		result.data.meta_pixel_id
	);
	// Preserve fresh-load Overview behavior after seeding through the connection screen.
	await page.evaluate( () =>
		window.history.replaceState(
			null,
			'',
			window.location.pathname + window.location.search
		)
	);
}

/**
 * Intercept every Meta URL. The SDK stub records calls but never sends events.
 *
 * @param {import('@playwright/test').BrowserContext} context Isolated browser.
 * @return {Promise<Object>} SDK/gate request counters.
 */
async function interceptMeta( context ) {
	const requests = { sdk: 0, gate: 0 };
	context.on( 'request', ( request ) => {
		if ( request.url().includes( 'action=pixelpair_bootstrap' ) ) {
			++requests.gate;
		}
	} );
	await context.route(
		/https:\/\/[^/]*(?:facebook|fbcdn)\.[^/]+\//,
		async ( route ) => {
			if ( route.request().url().endsWith( '/fbevents.js' ) ) {
				++requests.sdk;
				await route.fulfill( {
					contentType: 'application/javascript',
					body: 'window.metaCalls=[];window.fbq.callMethod=function(){window.metaCalls.push(Array.from(arguments));};window.fbq.queue.forEach(function(args){window.fbq.callMethod.apply(null,args);});window.fbq.queue=[];',
				} );
			} else {
				await route.abort();
			}
		}
	);
	return requests;
}

const visitorOptions = {
	userAgent:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
};
module.exports = { login, settings, interceptMeta, visitorOptions };
