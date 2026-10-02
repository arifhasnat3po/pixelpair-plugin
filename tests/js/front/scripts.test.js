import { startScripts } from '../../../assets/src/front/scripts';
const flush = async () => {
	for ( let i = 0; i < 10; i++ ) {
		await Promise.resolve();
	}
};
afterEach( () => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
} );
test( 'scripts stay inert until consent, run once, and recheck after eligibility', async () => {
	document.body.innerHTML =
		'<script type="application/json" class="pixelpair-script-slot"></script>';
	document.querySelector( 'script' ).textContent = JSON.stringify( {
		rows: [
			{
				code: '<div id="allowed">ok</div>',
				device: 'all',
				consent: 'marketing',
			},
		],
		consent: { required: true },
		gate: { required: true, url: '/gate' },
	} );
	let resolve;
	const fetch = jest.fn(
		() =>
			new Promise( ( r ) => {
				resolve = r;
			} )
	);
	const stop = startScripts( { fetch } );
	await flush();
	expect( fetch ).not.toHaveBeenCalled();
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	expect( fetch ).toHaveBeenCalledTimes( 1 );
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: false } } )
	);
	resolve( {
		ok: true,
		json: async () => ( { allowed: true, marketing_allowed: true } ),
	} );
	await flush();
	expect( document.getElementById( 'allowed' ) ).toBeNull();
	fetch.mockResolvedValue( {
		ok: true,
		json: async () => ( { allowed: true, marketing_allowed: true } ),
	} );
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	expect( document.getElementById( 'allowed' ) ).not.toBeNull();
	document.dispatchEvent(
		new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
	);
	await flush();
	expect( document.querySelectorAll( '#allowed' ) ).toHaveLength( 1 );
	stop();
} );
test( 'device mismatch never requests or inserts code', async () => {
	window.matchMedia = () => ( { matches: true } );
	document.body.innerHTML =
		'<script type="application/json" class="pixelpair-script-slot"></script>';
	document.querySelector( 'script' ).textContent = JSON.stringify( {
		rows: [
			{
				code: '<div id="desktop"></div>',
				device: 'desktop',
				consent: 'statistics',
			},
		],
		consent: {},
	} );
	const stop = startScripts();
	await flush();
	expect( document.getElementById( 'desktop' ) ).toBeNull();
	stop();
	delete window.matchMedia;
} );
