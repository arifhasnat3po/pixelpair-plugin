const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `sentence builder validates, retains failed drafts and saves Contact at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		await page.goto(
			'/wp-admin/admin.php?page=pixelpair#/events/custom/new'
		);
		await page
			.getByLabel( 'Event name', { exact: true } )
			.fill( 'Book a call test' );
		await page
			.getByLabel( 'An element matching', { exact: true } )
			.fill( 'button:has(script)' );
		await expect(
			page.getByLabel( 'An element matching', { exact: true } )
		).toHaveAttribute( 'aria-invalid', 'true' );
		await expect(
			page.getByRole( 'button', {
				name: 'Save and turn on',
				exact: true,
			} )
		).toBeDisabled();
		await page
			.getByLabel( 'An element matching', { exact: true } )
			.fill( '.book-call-btn' );
		await page.getByText( "Show what's sent", { exact: true } ).focus();
		await page.keyboard.press( 'Enter' );
		await expect( page.locator( '.pixelpair-payload' ) ).toContainText(
			'Contact'
		);
		await page
			.locator( '.pixelpair-app' )
			.getByRole( 'link', { name: 'Overview', exact: true } )
			.click();
		await expect(
			page.getByRole( 'dialog', { name: 'Discard unsaved changes?' } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Cancel', exact: true } )
			.click();
		await page.route(
			restRoute( '/pixelpair/v1/events' ),
			( route ) =>
				route.request().method() === 'POST'
					? route.fulfill( {
							status: 500,
							contentType: 'application/json',
							body: JSON.stringify( {
								message:
									'The event could not be saved. Try again.',
							} ),
						} )
					: route.continue(),
			{ times: 1 }
		);
		await page
			.getByRole( 'button', { name: 'Save and turn on', exact: true } )
			.click();
		await expect(
			page.locator( '.pixelpair-feedback[role="alert"]' )
		).toContainText( 'The event could not be saved.' );
		await expect(
			page.getByLabel( 'An element matching', { exact: true } )
		).toHaveValue( '.book-call-btn' );
		await captureScreen( page, 'event-builder-error', width );
		await page
			.getByRole( 'button', { name: 'Save and turn on', exact: true } )
			.click();
		await expect( page ).toHaveURL( /#\/events\/custom$/ );
		const rows = page.getByRole( 'row' );
		const row = rows.filter( {
			has: page.getByRole( 'rowheader', {
				name: 'Book a call test',
				exact: true,
			} ),
		} );
		await expect( row ).toContainText( 'On' );
		await row.getByRole( 'button', { name: 'Edit', exact: true } ).click();
		await expect(
			page.getByLabel( 'An element matching', { exact: true } )
		).toHaveValue( '.book-call-btn' );
		await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
		await captureScreen( page, 'event-builder', width );
		await page
			.getByRole( 'button', { name: 'Add condition', exact: true } )
			.click();
		await page
			.getByLabel( 'Only if', { exact: true } )
			.selectOption( 'url_contains' );
		await page.getByLabel( 'Matches', { exact: true } ).fill( '/pricing' );
		await page
			.getByRole( 'button', { name: 'Save changes', exact: true } )
			.click();
		await expect( page ).toHaveURL( /#\/events\/custom$/ );
		await row.getByText( 'More', { exact: true } ).click();
		await row
			.getByRole( 'button', { name: 'Delete', exact: true } )
			.click();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Delete event', exact: true } )
			.click();
		await expect( row ).toHaveCount( 0 );
	} );
}
