const { test, expect } = require( '@playwright/test' );
const { writeFileSync } = require( 'node:fs' );
const { login, settings } = require( './fixtures/wordpress' );
const { restRoute } = require( './fixtures/rest' );
test.setTimeout( 90000 );

async function cleanup( page ) {
	const remaining = await page.evaluate( async () => {
		const base = window.pixelpairAdmin.settingsUrl.replace(
			'/settings',
			''
		);
		const headers = {
			'Content-Type': 'application/json',
			'X-WP-Nonce': window.pixelpairAdmin.nonce,
		};
		const list = async () => {
			const response = await fetch( `${ base }/events`, { headers } );
			if ( ! response.ok ) {
				throw new Error( 'Could not read the usability test events.' );
			}
			return ( await response.json() ).filter(
				( item ) => item.name === 'Usability Book a call'
			);
		};
		for ( const event of await list() ) {
			const response = await fetch( `${ base }/events/${ event.id }`, {
				method: 'DELETE',
				headers,
				body: JSON.stringify( { confirm: 'yes' } ),
			} );
			if ( ! response.ok ) {
				throw new Error( 'Could not remove the usability test event.' );
			}
		}
		await fetch( `${ base }/meta`, {
			method: 'POST',
			headers,
			body: JSON.stringify( { test_code: '' } ),
		} );
		return ( await list() ).length;
	} );
	expect( remaining ).toBe( 0 );
}

test.afterEach( async ( { page } ) => {
	await cleanup( page );
	await settings( page, { onboarding_complete: true } );
} );

test( 'five everyday tasks have direct actions and measured completion', async ( {
	page,
} ) => {
	await login( page );
	await settings( page, {
		onboarding_complete: true,
		meta_enabled: true,
		meta_pixel_id: '123456789012345',
		meta_capi_enabled: true,
	} );
	await cleanup( page );
	const records = [];
	const begin = async () => {
		await page.evaluate( () => {
			window.taskClicks = 0;
			document.querySelector( '.pixelpair-app' ).onclick = () =>
				window.taskClicks++;
		} );
		return Date.now();
	};
	const finish = async ( task, started, targetClicks ) => {
		const record = {
			task,
			seconds: ( Date.now() - started ) / 1000,
			clicks: await page.evaluate( () => window.taskClicks ),
		};
		expect( record.clicks ).toBeLessThanOrEqual( targetClicks );
		records.push( record );
	};
	await page.evaluate( async () =>
		fetch(
			window.pixelpairAdmin.settingsUrl.replace( '/settings', '/meta' ),
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.pixelpairAdmin.nonce,
				},
				body: JSON.stringify( { remove_token: true, test_code: '' } ),
			}
		)
	);
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/overview' );
	await expect(
		page.getByRole( 'button', { name: 'Fix Meta', exact: true } )
	).toBeVisible();
	let started = await begin();
	await page.getByRole( 'button', { name: 'Fix Meta', exact: true } ).click();
	await expect(
		page.getByRole( 'heading', { name: 'Meta', level: 1 } )
	).toBeFocused();
	await finish( 'Identify problem and reach fix', started, 1 );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/events/custom' );
	await expect(
		page.getByRole( 'button', { name: /^(New event|Create an event)$/ } )
	).toBeVisible();
	started = await begin();
	await page
		.getByRole( 'button', { name: /^(New event|Create an event)$/ } )
		.click();
	await page.getByLabel( 'Event name', { exact: true } ).click();
	await page
		.getByLabel( 'Event name', { exact: true } )
		.fill( 'Usability Book a call' );
	await page.getByLabel( 'An element matching', { exact: true } ).click();
	await page
		.getByLabel( 'An element matching', { exact: true } )
		.fill( '.book-call-btn' );
	await expect(
		page.getByLabel( 'Meta event name', { exact: true } )
	).toHaveValue( 'Contact' );
	await page
		.getByRole( 'button', { name: 'Save and turn on', exact: true } )
		.click();
	await expect(
		page.getByRole( 'rowheader', { name: 'Usability Book a call' } )
	).toBeVisible();
	await finish( 'Create button-click Contact event', started, 4 );
	expect( records[ 1 ].seconds ).toBeLessThan( 120 );
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/privacy' );
	await expect(
		page.getByLabel( 'IP addresses', { exact: true } )
	).toBeVisible();
	let saves = 0;
	page.on( 'request', ( request ) => {
		if (
			request.method() === 'POST' &&
			restRoute( '/pixelpair/v1/settings' )( new URL( request.url() ) )
		) {
			saves++;
		}
	} );
	started = await begin();
	await page.getByLabel( 'IP addresses', { exact: true } ).click();
	await page
		.getByLabel( 'IP addresses', { exact: true } )
		.fill( '192.0.2.15' );
	await page
		.getByRole( 'button', { name: 'Save changes', exact: true } )
		.click();
	await expect( page.locator( '.pixelpair-savebar' ) ).toHaveCount( 0 );
	await finish( 'Exclude own IP', started, 2 );
	expect( saves ).toBe( 1 );
	await page.evaluate( async () =>
		fetch(
			window.pixelpairAdmin.settingsUrl.replace( '/settings', '/meta' ),
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.pixelpairAdmin.nonce,
				},
				body: JSON.stringify( { test_code: 'TEST_UI_TASK' } ),
			}
		)
	);
	for ( const route of [ 'overview', 'connections/meta' ] ) {
		await page.goto( `/wp-admin/admin.php?page=pixelpair#/${ route }` );
		await expect(
			page.getByRole( 'button', {
				name: 'Turn off test mode',
				exact: true,
			} )
		).toBeVisible();
		started = await begin();
		await page
			.getByRole( 'button', { name: 'Turn off test mode', exact: true } )
			.click();
		await expect(
			page.getByRole( 'button', {
				name: 'Turn off test mode',
				exact: true,
			} )
		).toHaveCount( 0 );
		await finish( `Turn off test mode from ${ route }`, started, 1 );
		await page.evaluate( async () =>
			fetch(
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
					body: JSON.stringify( { test_code: 'TEST_UI_TASK' } ),
				}
			)
		);
	}
	await page.goto( '/wp-admin/admin.php?page=pixelpair#/events' );
	const row = page.locator( '.pixelpair-toggle-row' ).filter( {
		has: page.getByText( 'Form submissions', { exact: true } ),
	} );
	const original = await row.getByRole( 'checkbox' ).isChecked();
	started = await begin();
	await row.getByRole( 'checkbox' ).click();
	await row.getByRole( 'button', { name: 'Undo', exact: true } ).click();
	await expect( row.getByRole( 'checkbox' ) ).toBeChecked( {
		checked: original,
	} );
	await finish( 'Toggle automatic event and undo', started, 2 );
	writeFileSync(
		test.info().outputPath( 'usability-timing.json' ),
		JSON.stringify( records, null, 2 )
	);
} );
