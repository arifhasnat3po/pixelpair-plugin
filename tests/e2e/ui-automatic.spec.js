const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
for ( const width of [ 1280, 782 ] ) {
	test( `automatic events support failure recovery, Undo and focused details at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		const original = await page.evaluate( async () =>
			(
				await fetch( window.pixelpairAdmin.settingsUrl, {
					headers: { 'X-WP-Nonce': window.pixelpairAdmin.nonce },
				} )
			).json()
		);
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/events' );
		await expect(
			page.getByRole( 'heading', { name: 'Events', level: 1 } )
		).toBeFocused();
		await expect(
			page.getByLabel( 'Page views', { exact: true } )
		).toBeDisabled();
		const rows = page.locator( '.pixelpair-toggle-row' );
		const form = rows.filter( {
			has: page.getByText( 'Form submissions', { exact: true } ),
		} );
		await page.route(
			/pixelpair(?:%2F|\/)v1(?:%2F|\/)settings/,
			( route ) =>
				route.request().method() === 'POST'
					? route.fulfill( {
							status: 500,
							contentType: 'application/json',
							body: JSON.stringify( {
								message: 'Settings could not be saved.',
							} ),
						} )
					: route.continue(),
			{ times: 1 }
		);
		const before = await form.getByRole( 'checkbox' ).isChecked();
		await form.getByRole( 'checkbox' ).click();
		await expect( form.getByRole( 'alert' ) ).toContainText(
			'Could not update Form submissions. Try again.'
		);
		await expect( form.getByRole( 'checkbox' ) ).toBeChecked( {
			checked: before,
		} );
		await form.getByRole( 'checkbox' ).click();
		await form.getByRole( 'button', { name: 'Undo', exact: true } ).click();
		await expect( form.getByRole( 'checkbox' ) ).toBeChecked( {
			checked: before,
		} );
		await expect( form.getByRole( 'status' ) ).toContainText(
			'Change undone.'
		);
		await captureScreen( page, 'events-automatic', width );
		await page
			.getByRole( 'button', {
				name: 'Edit Form submissions',
				exact: true,
			} )
			.click();
		await page
			.getByLabel( 'Meta event name', { exact: true } )
			.fill( 'Contact' );
		await page.getByText( "Show what's sent", { exact: true } ).click();
		await expect( page.locator( '.pixelpair-payload' ) ).toContainText(
			'Contact'
		);
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await captureScreen( page, 'events-detail', width );
		await page
			.getByRole( 'button', { name: 'Back to Events', exact: true } )
			.click();
		await page.getByText( 'Advanced', { exact: true } ).click();
		await page
			.getByRole( 'button', {
				name: 'Configure event data',
				exact: true,
			} )
			.click();
		await expect(
			page.getByLabel( 'Capture consented form email and phone', {
				exact: true,
			} )
		).toBeVisible();
		await captureScreen( page, 'events-data', width );
		await settings( page, { automatic_events: original.automatic_events } );
	} );
}
