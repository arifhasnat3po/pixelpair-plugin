const { expect, test } = require( '@playwright/test' );

async function captureScreen( page, name, width ) {
	await page.evaluate( () =>
		Promise.all(
			document
				.querySelector( '.pixelpair-app' )
				.getAnimations( { subtree: true } )
				.filter(
					( animation ) =>
						animation.animationName === 'pixelpair-reveal' &&
						animation.playState === 'running'
				)
				.map( ( animation ) => animation.finished.catch( () => {} ) )
		)
	);
	await page.addScriptTag( {
		path: require.resolve( 'axe-core/axe.min.js' ),
	} );
	const issues = await page.evaluate( async () =>
		(
			await window.axe.run( {
				include: [
					...document.querySelectorAll(
						'.pixelpair-app, .pixelpair-dialog'
					),
				],
			} )
		).violations.filter( ( issue ) =>
			[ 'serious', 'critical' ].includes( issue.impact )
		)
	);
	expect( issues ).toEqual( [] );
	expect(
		await page
			.locator( '.pixelpair-app' )
			.evaluate(
				( element ) => element.scrollWidth <= element.clientWidth
			)
	).toBe( true );
	await page.evaluate( () => window.scrollTo( 0, 0 ) );
	await page.screenshot( {
		path: test.info().outputPath( `${ name }-${ width }.png` ),
		fullPage: true,
	} );
}
module.exports = { captureScreen };
