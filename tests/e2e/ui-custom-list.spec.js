const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `custom event list supports retries, Undo and named deletion at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		const created = await page.evaluate( async () => {
			const response = await fetch(
				window.pixelpairAdmin.settingsUrl.replace(
					/settings$/,
					'events'
				),
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.pixelpairAdmin.nonce,
					},
					body: JSON.stringify( {
						name: 'Book a call',
						status: 'active',
						triggers: [
							{ type: 'click', value: '.book-call-btn' },
						],
						conditions: [],
						once_per_session: false,
						platforms: Object.fromEntries(
							[ 'meta', 'ga4', 'gtm' ].map( ( key ) => [
								key,
								{
									enabled: key === 'meta',
									name:
										key === 'meta'
											? 'Contact'
											: 'generate_lead',
									params: {},
									server: key === 'meta',
								},
							] )
						),
					} ),
				}
			);
			return { status: response.status, data: await response.json() };
		} );
		expect( created.status ).toBe( 200 );
		await page.route(
			restRoute( '/pixelpair/v1/events' ),
			( route ) =>
				route.fulfill( {
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify( {
						message: 'Connection lost. Retry to load events.',
					} ),
				} ),
			{ times: 1 }
		);
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/events/custom' );
		await expect( page.getByRole( 'alert' ) ).toContainText(
			'Connection lost.'
		);
		await page
			.getByRole( 'button', { name: 'Retry', exact: true } )
			.click();
		const rows = page.getByRole( 'row' );
		const row = rows.filter( {
			has: page.getByRole( 'rowheader', {
				name: 'Book a call',
				exact: true,
			} ),
		} );
		await expect( row ).toContainText( 'Clicks .book-call-btn' );
		await row
			.getByRole( 'button', { name: 'Turn off', exact: true } )
			.click();
		await page.getByRole( 'button', { name: 'Undo', exact: true } ).click();
		await expect(
			row.getByRole( 'button', { name: 'Turn off', exact: true } )
		).toBeEnabled();
		await captureScreen( page, 'events-custom', width );
		await row.getByText( 'More', { exact: true } ).focus();
		await page.keyboard.press( 'Enter' );
		await row
			.getByRole( 'button', { name: 'Duplicate', exact: true } )
			.click();
		const copy = rows.filter( {
			has: page.getByRole( 'rowheader', {
				name: 'Book a call (copy)',
				exact: true,
			} ),
		} );
		await expect( copy ).toContainText( 'Off' );
		await row
			.getByRole( 'button', { name: 'Delete', exact: true } )
			.click();
		await expect(
			page.getByRole( 'dialog', { name: 'Delete “Book a call”?' } )
		).toBeVisible();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Cancel', exact: true } )
			.click();
		await expect( row ).toBeVisible();
		await row
			.getByRole( 'button', { name: 'Delete', exact: true } )
			.click();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Delete event', exact: true } )
			.click();
		await expect( row ).toHaveCount( 0 );
		await copy.getByText( 'More', { exact: true } ).click();
		await copy
			.getByRole( 'button', { name: 'Delete', exact: true } )
			.click();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Delete event', exact: true } )
			.click();
		await expect( copy ).toHaveCount( 0 );
		await captureScreen( page, 'events-custom-empty', width );
	} );
}
