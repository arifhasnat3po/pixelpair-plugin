import {
	startRules,
	matchesConditions,
	resolveParams,
} from '../../../assets/src/front/rules';
const context = {
	home: true,
	post_id: 42,
	post_type: 'post',
	post_title: 'Hello',
	term_ids: [ 'category:2' ],
	roles: [ 'subscriber' ],
	session_count: 3,
	url: 'https://example.test/offer?coupon=SAVE&utm_source=news&utm_medium=email&utm_campaign=fall',
	referrer: 'https://ref.test/path',
	device: 'desktop',
};
const rule = ( trigger ) => ( {
	id: 1,
	triggers: [ trigger ],
	conditions: [],
	once_per_session: false,
	platforms: {},
} );
let stop;
afterEach( () => {
	stop?.();
	sessionStorage.clear();
	document.body.innerHTML = '';
	jest.useRealTimers();
	delete window.IntersectionObserver;
} );
test.each( [
	{ type: 'url', operator: 'equals', value: context.url },
	{ type: 'url', operator: 'contains', value: '/offer' },
	{ type: 'url', operator: 'starts', value: 'https://example.test/' },
	{ type: 'url', operator: 'regex', value: '^https://example.test/offer.*$' },
	{ type: 'home' },
	{ type: 'post_type', value: 'post' },
	{ type: 'posts', value: '21,42' },
	{ type: 'terms', value: 'category:2' },
	{ type: 'page_count', value: 3 },
	{ type: 'url_param', key: 'coupon', operator: 'present' },
	{ type: 'url_param', key: 'coupon', operator: 'equals', value: 'SAVE' },
] )( 'page trigger %o fires once per document', ( trigger ) => {
	const send = jest.fn( () => true );
	stop = startRules( [ rule( trigger ) ], context, send );
	expect( send ).toHaveBeenCalledTimes( 1 );
} );
test( 'conditions combine with AND and missing authenticated roles fail closed', () => {
	const c = [
		{ type: 'device', value: 'desktop' },
		{ type: 'role', value: 'subscriber' },
		{ type: 'url_contains', value: 'offer' },
		{ type: 'url_not_contains', value: 'checkout' },
		{ type: 'utm_source', value: 'news' },
		{ type: 'utm_medium', value: 'email' },
		{ type: 'utm_campaign', value: 'fall' },
		{ type: 'referrer_domain', value: 'ref.test' },
	];
	expect( matchesConditions( c, context ) ).toBe( true );
	expect( matchesConditions( c, { ...context, roles: undefined } ) ).toBe(
		false
	);
	expect(
		matchesConditions(
			[ ...c, { type: 'device', value: 'mobile' } ],
			context
		)
	).toBe( false );
} );
test( 'click, link, mouseover and visibility triggers use DOM observers and clean up', () => {
	document.body.innerHTML = '<a class="cta" href="/offer">Offer</a>';
	let observe;
	window.IntersectionObserver = jest.fn( ( callback ) => {
		observe = callback;
		return { observe: jest.fn(), disconnect: jest.fn() };
	} );
	const triggers = [
		{ type: 'click', value: '.cta' },
		{ type: 'link', operator: 'contains', value: '/offer' },
		{ type: 'mouseover', value: '.cta' },
		{ type: 'visible', value: '.cta' },
	];
	const send = jest.fn( () => true );
	stop = startRules(
		triggers.map( ( t, i ) => ( { ...rule( t ), id: i + 1 } ) ),
		context,
		send
	);
	const a = document.querySelector( 'a' );
	a.dispatchEvent( new window.MouseEvent( 'click', { bubbles: true } ) );
	a.dispatchEvent( new window.MouseEvent( 'mouseover', { bubbles: true } ) );
	observe( [ { isIntersecting: true } ] );
	expect( send ).toHaveBeenCalledTimes( 4 );
	stop();
	a.dispatchEvent( new window.MouseEvent( 'click', { bubbles: true } ) );
	expect( send ).toHaveBeenCalledTimes( 4 );
} );
test( 'visible timers, delayed visits, OR triggers and session-once limits', () => {
	jest.useFakeTimers();
	Object.defineProperty( document, 'hidden', {
		configurable: true,
		value: false,
	} );
	const send = jest.fn( () => true );
	const r = {
		...rule( { type: 'home', delay: 2 } ),
		once_per_session: true,
		triggers: [
			{ type: 'home', delay: 2 },
			{ type: 'time', value: 2 },
		],
	};
	stop = startRules( [ r ], context, send );
	jest.advanceTimersByTime( 2000 );
	expect( send ).toHaveBeenCalledTimes( 1 );
	stop();
	stop = startRules( [ r ], context, send );
	jest.advanceTimersByTime( 5000 );
	expect( send ).toHaveBeenCalledTimes( 1 );
} );
test( 'tokens substitute values without executing JavaScript or exposing absent tokens', () => {
	expect(
		resolveParams(
			{
				title: '{post_title}',
				coupon: '{url_param:coupon}',
				id: '{post_id}',
			},
			context
		)
	).toEqual( { title: 'Hello', coupon: 'SAVE', id: 42 } );
} );
test( 'custom scroll remains once per document when session storage is unavailable', () => {
	const read = jest
		.spyOn( Storage.prototype, 'getItem' )
		.mockImplementation( () => {
			throw new Error( 'blocked' );
		} );
	const write = jest
		.spyOn( Storage.prototype, 'setItem' )
		.mockImplementation( () => {
			throw new Error( 'blocked' );
		} );
	try {
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
			value: 1000,
		} );
		const send = jest.fn( () => true );
		stop = startRules(
			[
				{
					...rule( { type: 'scroll', value: 90 } ),
					once_per_session: true,
				},
			],
			context,
			send
		);
		window.dispatchEvent( new Event( 'scroll' ) );
		window.dispatchEvent( new Event( 'scroll' ) );
		expect( send ).toHaveBeenCalledTimes( 1 );
	} finally {
		read.mockRestore();
		write.mockRestore();
	}
} );
