const { test, expect } = require( '@playwright/test' );
const { writeFileSync } = require( 'node:fs' );
const {
	login,
	settings,
	interceptMeta,
	visitorOptions,
} = require( './fixtures/wordpress' );

async function audit( page, name ) {
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
		path: test.info().outputPath( `${ name }.png` ),
		fullPage: true,
	} );
}

for ( const width of [ 1280, 782 ] ) {
	test( `first Meta connection by snippet in seven clicks at ${ width }`, async ( {
		page,
		browser,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: false,
			excluded_roles: [ 'editor' ],
		} );
		await page.reload();
		await expect(
			page.getByRole( 'heading', {
				name: 'What do you want to track?',
				level: 1,
			} )
		).toBeVisible();
		await audit( page, `setup-choose-${ width }` );
		await page.evaluate( () => {
			window.setupClicks = 0;
			document
				.querySelector( '.pixelpair-app' )
				.addEventListener( 'click', () => window.setupClicks++ );
		} );
		const started = Date.now();
		await page.getByLabel( 'Facebook and Instagram ads (Meta)' ).check();
		await page
			.getByRole( 'button', { name: 'Continue', exact: true } )
			.click();
		const id = page.getByLabel( 'Meta Pixel ID', { exact: true } );
		await id.click();
		await id.fill(
			"<script>fbq('init', '123456789012345');fbq('track','PageView');</script>"
		);
		await expect( id ).toHaveValue( '123456789012345' );
		await audit( page, `setup-connect-${ width }` );
		await page.getByRole( 'button', { name: 'Save and continue' } ).click();
		await expect(
			page.getByRole( 'heading', { name: 'Check it works', level: 1 } )
		).toBeFocused();
		await page.getByRole( 'button', { name: 'Check connection' } ).click();
		await expect( page.locator( '.pixelpair-feedback' ) ).toContainText(
			'Browser tracking is configured'
		);
		await audit( page, `setup-check-${ width }` );
		await page
			.getByRole( 'button', { name: 'Continue', exact: true } )
			.click();
		await expect(
			page.getByLabel( 'Don’t track my visits while I’m logged in' )
		).toBeChecked();
		await audit( page, `setup-exclude-${ width }` );
		await page.getByRole( 'button', { name: 'Finish setup' } ).click();
		await expect(
			page.getByRole( 'heading', { name: 'Overview', level: 1 } )
		).toBeVisible();
		const clicks = await page.evaluate( () => window.setupClicks );
		const seconds = ( Date.now() - started ) / 1000;
		expect( clicks ).toBeLessThan( 8 );
		expect( seconds ).toBeLessThan( 180 );
		const timing = test.info();
		writeFileSync(
			timing.outputPath( 'setup-timing.json' ),
			JSON.stringify(
				{ width, clicks, seconds, includesScreenshotAndAxeTime: true },
				null,
				2
			)
		);
		await timing.attach( 'setup-timing.json', {
			body: JSON.stringify( {
				width,
				clicks,
				seconds,
				includesScreenshotAndAxeTime: true,
			} ),
			contentType: 'application/json',
		} );
		const visitor = await browser.newContext( {
			baseURL: test.info().project.use.baseURL,
			...visitorOptions,
		} );
		await interceptMeta( visitor );
		const site = await visitor.newPage();
		await site.goto( '/' );
		await expect
			.poll( () =>
				site.evaluate( () =>
					( window.metaCalls || [] ).some(
						( call ) =>
							call[ 0 ] === 'track' && call[ 1 ] === 'PageView'
					)
				)
			)
			.toBe( true );
		await visitor.close();
	} );
}

test( 'skip discards unsaved connection changes and navigation requires confirmation', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: false } );
	await page.reload();
	await page.getByLabel( 'Facebook and Instagram ads (Meta)' ).check();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page
		.getByLabel( 'Meta Pixel ID', { exact: true } )
		.fill( '123456789012345' );
	await page
		.locator( '.pixelpair-nav' )
		.getByRole( 'link', { name: 'Settings', exact: true } )
		.click();
	await expect(
		page.getByRole( 'dialog', { name: 'Discard unsaved changes?' } )
	).toBeVisible();
	await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect(
		page.getByLabel( 'Meta Pixel ID', { exact: true } )
	).toHaveValue( '123456789012345' );
	let releaseSave;
	const saveHeld = new Promise( ( resolve ) => {
		releaseSave = resolve;
	} );
	await page.route(
		/pixelpair(?:%2F|\/)v1(?:%2F|\/)settings/,
		async ( route ) => {
			if ( route.request().method() === 'POST' ) {
				await saveHeld;
			}
			await route.continue();
		}
	);
	try {
		await page.getByRole( 'button', { name: 'Skip setup' } ).click();
		await expect(
			page.getByRole( 'button', { name: 'Skip setup' } )
		).toBeDisabled();
		await expect(
			page.getByRole( 'heading', { name: 'Connect', level: 1 } )
		).toBeVisible();
		await expect(
			page.getByRole( 'heading', { name: 'Overview', level: 1 } )
		).toHaveCount( 0 );
	} finally {
		releaseSave();
	}
	await expect(
		page.getByRole( 'heading', { name: 'Overview', level: 1 } )
	).toBeVisible();
	const saved = await page.evaluate( async () =>
		(
			await fetch( window.pixelpairAdmin.settingsUrl, {
				headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
			} )
		).json()
	);
	expect( saved.meta_enabled ).toBe( false );
	expect( saved.meta_pixel_id ).toBe( '' );
	expect( saved.onboarding_complete ).toBe( true );
} );

test( 'explicit server check keeps button width, masks credentials and turns test mode off', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, { onboarding_complete: false } );
	await page.reload();
	await page.getByLabel( 'Facebook and Instagram ads (Meta)' ).check();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page
		.getByLabel( 'Meta Pixel ID', { exact: true } )
		.fill( '123456789012345' );
	await page
		.getByLabel( 'Send events from your server too', { exact: true } )
		.check();
	await page
		.getByLabel( 'Access token', { exact: true } )
		.fill( 'EAA_test_fixture_not_a_real_token' );
	await page.getByRole( 'button', { name: 'Save and continue' } ).click();
	await page
		.getByLabel( 'Test event code', { exact: true } )
		.fill( 'TEST_FIXTURE' );
	let release;
	const held = new Promise( ( resolve ) => {
		release = resolve;
	} );
	await page.route(
		/pixelpair(?:%2F|\/)v1(?:%2F|\/)meta(?:%2F|\/)test/,
		async ( route ) => {
			await held;
			await route.fulfill( {
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify( {
					success: true,
					code: 200,
					response: { events_received: 1 },
				} ),
			} );
		}
	);
	const check = page.getByRole( 'button', {
		name: 'Check connection',
		exact: true,
	} );
	const width = ( await check.boundingBox() ).width;
	await check.click();
	const checking = page.getByRole( 'button', {
		name: 'Checking…',
		exact: true,
	} );
	await expect( checking ).toBeDisabled();
	expect( ( await checking.boundingBox() ).width ).toBe( width );
	release();
	await expect(
		page
			.locator( '.pixelpair-feedback' )
			.filter( { hasText: 'Meta accepted the test event.' } )
	).toBeVisible();
	expect( await page.content() ).not.toContain(
		'EAA_test_fixture_not_a_real_token'
	);
	await page
		.getByRole( 'button', { name: 'Turn off test mode', exact: true } )
		.click();
	await expect(
		page.getByRole( 'button', { name: 'Turn off test mode', exact: true } )
	).toHaveCount( 0 );
	await page.evaluate( async () => {
		await fetch(
			window.pixelpairAdmin.settingsUrl.replace( '/settings', '/meta' ),
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.pixelpairAdmin.nonce,
				},
				body: JSON.stringify( { remove_token: true, test_code: '' } ),
			}
		);
	} );
	await page.getByRole( 'button', { name: 'Skip setup' } ).click();
	await expect(
		page.getByRole( 'heading', { name: 'Overview', level: 1 } )
	).toBeVisible();
	const retained = await page.evaluate( async () =>
		(
			await fetch( window.pixelpairAdmin.settingsUrl, {
				headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
			} )
		).json()
	);
	expect( retained.meta_enabled ).toBe( true );
	expect( retained.meta_pixel_id ).toBe( '123456789012345' );
	expect( retained.excluded_roles ).toEqual( [] );
	await settings( page, { onboarding_complete: true } );
} );
