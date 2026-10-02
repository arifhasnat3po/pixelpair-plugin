const { test, expect } = require( '@playwright/test' );
const { login, settings } = require( './fixtures/wordpress' );
for ( const width of [ 600, 782, 1280 ] ) {
	test( `keyboard controls stay above the save bar and checkbox help aligns at ${ width }`, async ( {
		page,
	} ) => {
		await page.setViewportSize( { width, height: 700 } );
		await login( page );
		await settings( page, { onboarding_complete: true } );
		await page.goto( '/wp-admin/admin.php?page=pixelpair#/privacy' );
		const align = await page
			.locator( '.pixelpair-check' )
			.first()
			.evaluate( ( element ) => {
				const range = element.ownerDocument.createRange();
				range.selectNodeContents(
					element.querySelector( '.components-base-control__help' )
				);
				return {
					label: element
						.querySelector( 'label' )
						.getBoundingClientRect().left,
					help: range.getBoundingClientRect().left,
				};
			} );
		expect( Math.abs( align.label - align.help ) ).toBeLessThan( 2 );
		await page
			.getByLabel( 'Wait for marketing consent', { exact: true } )
			.check();
		await page.getByText( 'Advanced', { exact: true } ).click();
		await page.getByLabel( 'IP addresses', { exact: true } ).focus();
		for ( let i = 0; i < 7; i++ ) {
			await page.keyboard.press( 'Tab' );
			const visible = await page.evaluate( () => {
				const bar = document.querySelector( '.pixelpair-savebar' );
				const active = bar.ownerDocument.activeElement;
				const box = active.getBoundingClientRect();
				return (
					bar.contains( active ) ||
					( box.bottom <= bar.getBoundingClientRect().top &&
						box.top >= 46 )
				);
			} );
			expect( visible ).toBe( true );
		}
	} );
}
