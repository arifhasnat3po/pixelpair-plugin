const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
const { captureScreen } = require( './fixtures/ui' );
const { restRoute } = require( './fixtures/rest' );
for ( const width of [ 1280, 782 ] ) {
	test( `Activity filters, redacted details and confirmed clearing at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 900 } );
		await login( page );
		await settings( page, {
			onboarding_complete: true,
			logging_enabled: true,
		} );
		let rows = [
			{
				id: 1,
				created_at: 1700000000,
				platform: 'meta',
				event_name: 'Purchase',
				status: 'sent',
				response_code: 200,
				details: JSON.stringify( {
					request: {
						user_data: '[redacted]',
						access_token: '[redacted]',
					},
					response: { events_received: 1 },
				} ),
			},
			{
				id: 2,
				created_at: 1700000020,
				platform: 'tiktok',
				event_name: 'Contact',
				status: 'failed',
				response_code: 401,
				details: JSON.stringify( {
					request: { user_data: '[redacted]' },
					response: { error_code: 401 },
				} ),
			},
		];
		let fail = true;
		let deletionConfirmation;
		await page.route( restRoute( '/pixelpair/v1/logs' ), ( route ) => {
			const url = new URL( route.request().url() );
			if ( fail ) {
				fail = false;
				return route.fulfill( {
					status: 503,
					json: { message: 'Activity unavailable. Try again.' },
				} );
			}
			if (
				( route.request().headers()[ 'x-http-method-override' ] ||
					route.request().method() ) === 'DELETE'
			) {
				deletionConfirmation = url.searchParams.get( 'confirm' );
				rows = [];
			}
			const items = rows.filter(
				( row ) =>
					( ! url.searchParams.get( 'platform' ) ||
						row.platform === url.searchParams.get( 'platform' ) ) &&
					( ! url.searchParams.get( 'status' ) ||
						row.status === url.searchParams.get( 'status' ) )
			);
			return route.fulfill( {
				json: { items, total: items.length, page: 1 },
			} );
		} );
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/activity' );
		await page
			.getByRole( 'button', { name: 'Retry', exact: true } )
			.click();
		await expect(
			page.getByRole( 'rowheader', { name: /Purchase/ } )
		).toBeVisible();
		await captureScreen( page, 'activity', width );
		await page
			.getByLabel( 'Connection filter', { exact: true } )
			.selectOption( 'tiktok' );
		await expect(
			page.getByRole( 'rowheader', { name: /Purchase/ } )
		).toHaveCount( 0 );
		await page.getByText( 'Show details', { exact: true } ).click();
		await expect(
			page.getByLabel( 'Redacted request and response' )
		).toContainText( '[redacted]' );
		await captureScreen( page, 'activity-details', width );
		const download = page.waitForEvent( 'download' );
		await page
			.getByRole( 'button', { name: 'Download this page as CSV' } )
			.click();
		expect( ( await download ).suggestedFilename() ).toBe(
			'pixelpair-logs-page.csv'
		);
		await page
			.getByRole( 'button', { name: 'Clear logs', exact: true } )
			.click();
		await expect(
			page.getByRole( 'dialog', { name: 'Clear all server logs?' } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Cancel', exact: true } )
			.click();
		await expect(
			page.getByRole( 'rowheader', { name: /Contact/ } )
		).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Clear logs', exact: true } )
			.click();
		await page
			.getByRole( 'button', { name: 'Clear all logs', exact: true } )
			.click();
		await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
		expect( deletionConfirmation ).toBe( 'yes' );
		await expect( page.getByRole( 'rowheader' ) ).toHaveCount( 0 );
		await captureScreen( page, 'activity-empty', width );
	} );
}
