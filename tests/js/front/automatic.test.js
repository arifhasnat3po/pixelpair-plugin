import {
	startAutomatic,
	hashFields,
} from '../../../assets/src/front/automatic';
const all = [
	'search',
	'form_submit',
	'file_download',
	'scroll_depth',
	'time_on_page',
	'not_found',
	'outbound_link',
];
const config = {
	automatic: Object.fromEntries(
		all.map( ( key ) => [ key, { enabled: key !== 'outbound_link' } ] )
	),
	scroll_thresholds: [ 25, 50, 75, 90 ],
	time_thresholds: [ 30, 60, 120 ],
	download_extensions: [ 'pdf', 'zip' ],
};
let stop;
test( 'all jQuery form providers fire on documented success callbacks and Ninja rejects error responses', () => {
	const handlers = {};
	const jq = {
		on: ( name, fn ) => {
			handlers[ name ] = fn;
		},
		off: jest.fn(),
	};
	window.jQuery = () => jq;
	let ninja;
	window.Backbone = {
		Radio: {
			channel: () => ( {
				on: ( _, fn ) => {
					ninja = fn;
				},
				off: jest.fn(),
			} ),
		},
	};
	document.body.innerHTML =
		'<form id="gform_42" class="elementor-form"></form>';
	const form = document.querySelector( 'form' );
	const send = jest.fn( () => true );
	stop = startAutomatic( config, send );
	for ( const name of [
		'wpformsAjaxSubmitSuccess',
		'gform_confirmation_loaded',
		'fluentform_submission_success',
		'forminator:form:submit:success',
		'frmFormComplete',
		'submit_success',
	] ) {
		const args = { gform_confirmation_loaded: 42, frmFormComplete: form };
		handlers[ name + '.pixelpair' ]( { target: form }, args[ name ] || {} );
	}
	ninja( { data: { form_id: 42 }, errors: { field: 'invalid' } } );
	expect( send ).toHaveBeenCalledTimes( 6 );
	ninja( { data: { form_id: 42 }, errors: {} } );
	expect( send ).toHaveBeenCalledTimes( 7 );
	expect( send.mock.calls.map( ( call ) => call[ 1 ].form_plugin ) ).toEqual(
		[
			'wpforms',
			'gravity-forms',
			'fluent-forms',
			'forminator',
			'formidable',
			'elementor',
			'ninja-forms',
		]
	);
	stop();
	expect( jq.off ).toHaveBeenCalledTimes( 6 );
} );
test( 'optional field matching hashes normalized values and skips ambiguous phone numbers', async () => {
	const { webcrypto } = require( 'node:crypto' );
	const { TextEncoder: Encoder } = require( 'node:util' );
	const old = window.crypto.subtle;
	Object.defineProperty( window.crypto, 'subtle', {
		configurable: true,
		value: webcrypto.subtle,
	} );
	const encoder = global.TextEncoder;
	global.TextEncoder = Encoder;
	try {
		const matching = await hashFields( {
			em: ' Test@Example.COM ',
			ph: '+1 (202) 555-0123',
		} );
		expect( matching.em ).toBe(
			'973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
		);
		expect( matching.ph ).toMatch( /^[a-f0-9]{64}$/ );
		expect(
			await hashFields( { em: 'not-an-email', ph: '0123456789' } )
		).toEqual( {} );
	} finally {
		Object.defineProperty( window.crypto, 'subtle', {
			configurable: true,
			value: old,
		} );
		global.TextEncoder = encoder;
	}
} );
afterEach( () => {
	stop?.();
	document.body.innerHTML = '';
	jest.useRealTimers();
	delete window.jQuery;
	delete window.Backbone;
} );
test( 'search, 404, download and unknown form fallback carry useful params and excluded forms do not fire', () => {
	const send = jest.fn( () => true );
	stop = startAutomatic(
		{ ...config, page: { search_string: 'boots', not_found: true } },
		send
	);
	expect( send ).toHaveBeenCalledWith( 'search', { search_string: 'boots' } );
	expect( send ).toHaveBeenCalledWith( 'not_found', {} );
	document.body.innerHTML =
		'<a href="https://other.test/report.pdf?x=1">PDF</a><form id="contact"></form><form role="search"></form><form id="loginform"></form><form class="woocommerce-checkout"></form><form class="wpcf7-form"></form>';
	document.querySelector( 'a' ).dispatchEvent(
		new window.MouseEvent( 'click', {
			bubbles: true,
			cancelable: true,
		} )
	);
	expect( send ).toHaveBeenCalledWith(
		'file_download',
		expect.objectContaining( {
			file_name: 'report.pdf',
			file_extension: 'pdf',
		} )
	);
	document
		.querySelectorAll( 'form' )
		.forEach( ( form ) =>
			form.dispatchEvent(
				new Event( 'submit', { bubbles: true, cancelable: true } )
			)
		);
	expect(
		send.mock.calls.filter( ( [ key ] ) => key === 'form_submit' )
	).toHaveLength( 1 );
	expect(
		send.mock.calls.filter( ( [ key ] ) => key === 'outbound_link' )
	).toHaveLength( 0 );
} );
test( 'visible time thresholds and scroll thresholds fire once, cleanup removes observers', () => {
	jest.useFakeTimers();
	const send = jest.fn( () => true );
	Object.defineProperty( document, 'hidden', {
		configurable: true,
		value: false,
	} );
	Object.defineProperty( document.documentElement, 'scrollHeight', {
		configurable: true,
		value: 2000,
	} );
	Object.defineProperty( window, 'innerHeight', {
		configurable: true,
		value: 1000,
	} );
	Object.defineProperty( window, 'scrollY', {
		configurable: true,
		value: 800,
	} );
	stop = startAutomatic( config, send );
	window.dispatchEvent( new Event( 'scroll' ) );
	window.dispatchEvent( new Event( 'scroll' ) );
	expect(
		send.mock.calls.filter( ( [ key ] ) => key === 'scroll_depth' )
	).toHaveLength( 4 );
	jest.advanceTimersByTime( 30000 );
	expect( send ).toHaveBeenCalledWith( 'time_on_page', { seconds: 30 } );
	Object.defineProperty( document, 'hidden', {
		configurable: true,
		value: true,
	} );
	jest.advanceTimersByTime( 120000 );
	expect(
		send.mock.calls.filter( ( [ key ] ) => key === 'time_on_page' )
	).toHaveLength( 1 );
	Object.defineProperty( document, 'hidden', {
		configurable: true,
		value: false,
	} );
	jest.advanceTimersByTime( 90000 );
	expect(
		send.mock.calls.filter( ( [ key ] ) => key === 'time_on_page' )
	).toHaveLength( 3 );
	stop();
	send.mockClear();
	jest.advanceTimersByTime( 120000 );
	window.dispatchEvent( new Event( 'scroll' ) );
	expect( send ).not.toHaveBeenCalled();
} );
test( 'CF7 success fires, invalid and spam do not; consent veto prevents optional field reads', () => {
	document.body.innerHTML =
		'<form id="f" class="wpcf7-form"><input type="email" value="personal@example.test"></form>';
	const send = jest.fn( () => true );
	stop = startAutomatic( { ...config, capture_form_fields: false }, send );
	for ( const name of [ 'wpcf7invalid', 'wpcf7spam', 'wpcf7mailsent' ] ) {
		document.querySelector( 'form' ).dispatchEvent(
			new CustomEvent( name, {
				bubbles: true,
				detail: { contactFormId: 42 },
			} )
		);
	}
	expect( send ).toHaveBeenCalledTimes( 1 );
	expect( send ).toHaveBeenCalledWith(
		'form_submit',
		expect.objectContaining( {
			form_plugin: 'contact-form-7',
			form_id: '42',
		} )
	);
	expect( JSON.stringify( send.mock.calls ) ).not.toContain( 'personal@' );
} );
test( 'unavailable digest falls back to an empty matching map', async () => {
	window.TextEncoder = require( 'util' ).TextEncoder;
	Object.defineProperty( window.crypto, 'subtle', {
		configurable: true,
		value: {
			digest: jest.fn().mockRejectedValue( new Error( 'Unavailable' ) ),
		},
	} );
	await expect(
		hashFields( { em: 'person@example.test' } )
	).resolves.toEqual( {} );
} );
