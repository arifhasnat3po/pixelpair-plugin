const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );

for ( const width of [ 1280, 782 ] ) {
	test( `Meta keeps partial saves honest and credentials private at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			meta_enabled: true,
			meta_pixel_id: '123456789012345',
		} );
		await page.evaluate( async () => {
			await fetch(
				window.pixelpairAdmin.settingsUrl.replace(
					'/settings',
					'/meta'
				),
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.pixelpairAdmin.nonce,
					},
					body: JSON.stringify( {
						remove_token: true,
						test_code: '',
					} ),
				}
			);
		} );
		await page.goto(
			'/wp-admin/admin.php?page=pixelpair#/connections/meta'
		);
		await page.reload();
		await expect(
			page.getByRole( 'heading', { name: 'Meta', level: 1 } )
		).toBeFocused();
		await page
			.getByLabel( 'Send events from your server too', { exact: true } )
			.check();
		await page
			.getByLabel( 'Access token', { exact: true } )
			.fill( 'EAA_fake_fixture_never_a_real_token' );
		const credentialPattern =
			/pixelpair(?:%2F|\/)v1(?:%2F|\/)meta(?:[?&]|$)/;
		await page.route( credentialPattern, ( route ) =>
			route.request().method() === 'POST'
				? route.fulfill( {
						status: 500,
						contentType: 'application/json',
						body: '{"message":"Token save failed"}',
					} )
				: route.continue()
		);
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect(
			page.locator( '.pixelpair-feedback[role="alert"]' )
		).toContainText(
			'Connection settings saved, but the token could not be saved'
		);
		await expect(
			page.getByLabel( 'Access token', { exact: true } )
		).toHaveValue( 'EAA_fake_fixture_never_a_real_token' );
		await page.unroute( credentialPattern );
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect(
			page.getByText( 'Token saved', { exact: true } )
		).toBeVisible();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		expect( await page.content() ).not.toContain(
			'EAA_fake_fixture_never_a_real_token'
		);
		await page
			.getByLabel( 'Test event code', { exact: true } )
			.fill( 'TEST_UI_ONLY' );
		await page.route(
			/pixelpair(?:%2F|\/)v1(?:%2F|\/)meta(?:%2F|\/)test/,
			( route ) =>
				route.fulfill( {
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify( {
						success: true,
						code: 200,
						response: { events_received: 1 },
					} ),
				} )
		);
		await page
			.getByRole( 'button', { name: 'Check connection', exact: true } )
			.click();
		await expect(
			page
				.locator( '.pixelpair-feedback' )
				.filter( { hasText: 'Meta accepted the test event.' } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Turn off test mode', exact: true } )
			.click();
		await expect(
			page.getByRole( 'button', {
				name: 'Turn off test mode',
				exact: true,
			} )
		).toHaveCount( 0 );
		await expect(
			page.getByLabel( 'Test event code', { exact: true } )
		).toHaveValue( '' );
		await page.addScriptTag( {
			path: require.resolve( 'axe-core/axe.min.js' ),
		} );
		expect(
			await page.evaluate( async () =>
				( await window.axe.run( '.pixelpair-app' ) ).violations.filter(
					( issue ) =>
						[ 'serious', 'critical' ].includes( issue.impact )
				)
			)
		).toEqual( [] );
		await page.evaluate( () => window.scrollTo( 0, 0 ) );
		await page.screenshot( {
			path: test.info().outputPath( `meta-${ width }.png` ),
			fullPage: true,
		} );
		await page.getByText( 'Advanced', { exact: true } ).click();
		await page.getByLabel( 'Advanced matching', { exact: true } ).check();
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await page
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await expect(
			page.getByRole( 'dialog', {
				name: 'Remove the Meta access token?',
			} )
		).toBeVisible();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Cancel', exact: true } )
			.click();
		await expect(
			page.getByText( 'Token saved', { exact: true } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Remove token', exact: true } )
			.click();
		await expect(
			page.getByLabel( 'Access token', { exact: true } )
		).toBeVisible();
		await settings( page, { onboarding_complete: true } );
	} );
}
