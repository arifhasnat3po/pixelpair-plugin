const { test, expect } = require( '@playwright/test' );
const { captureScreen } = require( './fixtures/ui' );

test( 'UI capture waits for panel reveal but ignores paused and unrelated animations', async ( {
	page,
} ) => {
	await page.setContent(
		`<style>@keyframes unrelated{from{opacity:0}to{opacity:1}}@keyframes pixelpair-reveal{from{opacity:0}to{opacity:1}}.paused{animation:unrelated 180ms paused}.forever{animation:unrelated 1s infinite}.fading{animation:pixelpair-reveal 180ms both}</style><main class="pixelpair-app"><h1>Capture fixture</h1><span class="paused" aria-hidden="true">Decorative</span><span class="forever" aria-hidden="true"></span><p class="fading">Readable after reveal</p></main>`
	);
	await captureScreen( page, 'capture-regression', 1280 );
	await expect( page.locator( '.fading' ) ).toHaveCSS( 'opacity', '1' );
} );
