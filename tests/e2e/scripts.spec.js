const { test, expect } = require( '@playwright/test' );
const { login, settings, visitorOptions } = require( './fixtures/wordpress' );
test.use( visitorOptions );

test( 'Head and Footer UI saves raw code, waits for consent and executes once', async ( {
	page,
	browser,
} ) => {
	await login( page );
	await settings( page, {
		deny_until_consent: true,
		strict_cache_mode: true,
		tiktok_enabled: false,
	} );
	await page
		.locator( '.pixelpair-app' )
		.getByRole( 'link', { name: 'Scripts', exact: true } )
		.click();
	const field = page.getByLabel( 'HTML and scripts', { exact: true } );
	await expect( field ).toBeVisible();
	await field.fill(
		'<script>window.pixelpairScriptCount=(window.pixelpairScriptCount||0)+1;</script>'
	);
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect(
		page.locator( '.pixelpair-app' ).getByText( 'Changes saved', {
			exact: true,
		} )
	).toBeVisible();
	const context = await browser.newContext( visitorOptions );
	const visitor = await context.newPage();
	try {
		await visitor.goto( '/' );
		expect(
			await visitor.evaluate( () => window.pixelpairScriptCount )
		).toBeUndefined();
		await visitor.evaluate( () =>
			document.dispatchEvent(
				new CustomEvent( 'pixelpair:consent', {
					detail: { marketing: true },
				} )
			)
		);
		await expect
			.poll( () => visitor.evaluate( () => window.pixelpairScriptCount ) )
			.toBe( 1 );
		await visitor.evaluate( () =>
			document.dispatchEvent(
				new CustomEvent( 'pixelpair:consent', {
					detail: { marketing: true },
				} )
			)
		);
		expect(
			await visitor.evaluate( () => window.pixelpairScriptCount )
		).toBe( 1 );
	} finally {
		await context.close();
		await field.fill( '' );
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect(
			page.locator( '.pixelpair-app' ).getByText( 'Changes saved', {
				exact: true,
			} )
		).toBeVisible();
	}
} );
