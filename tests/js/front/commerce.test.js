import { startCommerce } from '../../../assets/src/front/commerce';

const flush = async () => {
	for ( let i = 0; i < 10; i++ ) {
		await Promise.resolve();
	}
};

test( 'unresolved receipt consent waits without recording a withdrawal', async () => {
	const consent = {
		read: () => ( { granted: false, source: 'unresolved' } ),
		subscribe: () => () => {},
	};
	const fetch = jest.fn();
	const runtime = startCommerce(
		{
			commerce: {
				url: '/commerce',
				woo: { enabled: true, page: 'purchase' },
			},
		},
		{},
		consent,
		{ fetch }
	);
	await flush();
	expect( fetch ).not.toHaveBeenCalled();
	runtime.stop();
} );

test( 'receipt withdrawal reaches the server even when no destination remains ready', async () => {
	let granted = true;
	const consent = {
		read: () => ( { granted, source: 'integration' } ),
		subscribe: ( fn ) => {
			consent.change = fn;
			return () => {};
		},
	};
	const fetch = jest.fn( async () => ( {
		ok: true,
		json: async () => ( { events: [] } ),
	} ) );
	const state = { metaSend: jest.fn() };
	const runtime = startCommerce(
		{
			commerce: {
				url: '/commerce',
				woo: { enabled: true, page: 'purchase' },
			},
		},
		state,
		consent,
		{ fetch }
	);
	await flush();
	fetch.mockClear();
	granted = false;
	consent.change();
	await flush();
	expect( fetch ).toHaveBeenCalled();
	const body = JSON.parse( fetch.mock.calls[ 0 ][ 1 ].body );
	expect( body.action ).toBe( 'purchase' );
	expect( body.targets ).toEqual( [] );
	expect( body.consent.marketing.granted ).toBe( false );
	expect( state.metaSend ).not.toHaveBeenCalled();
	runtime.stop();
} );
test( 'commerce claims only ready destinations and refreshes once when another SDK becomes ready', async () => {
	const consent = {
		read: () => ( { granted: true, source: 'default' } ),
		subscribe: () => () => {},
	};
	let gaReady = false;
	const state = {
		googleAllowed: () => true,
		googleReady: ( id ) => id === 'gtm' || gaReady,
		googleSend: jest.fn(),
	};
	const fetch = jest.fn( async () => ( {
		ok: true,
		json: async () => ( { events: [] } ),
	} ) );
	const runtime = startCommerce(
		{
			commerce: {
				url: '/commerce',
				woo: { enabled: true, page: 'purchase' },
			},
			ga4: { enabled: true },
			gtm: { enabled: true },
		},
		state,
		consent,
		{ fetch }
	);
	await flush();
	expect( JSON.parse( fetch.mock.calls[ 0 ][ 1 ].body ).targets ).toEqual( [
		'gtm',
	] );
	const calls = fetch.mock.calls.length;
	runtime.refresh();
	await flush();
	expect( fetch ).toHaveBeenCalledTimes( calls );
	gaReady = true;
	runtime.refresh();
	await flush();
	expect( JSON.parse( fetch.mock.calls[ calls ][ 1 ].body ).targets ).toEqual(
		[ 'ga4' ]
	);
	runtime.stop();
} );
test( 'commerce waits for consent, sends verified item arrays with shared IDs and observes confirmed Blocks events', async () => {
	let granted = false;
	const consent = {
		read: () => ( { granted, source: 'integration' } ),
		subscribe: ( fn ) => {
			consent.change = fn;
			return () => {};
		},
	};
	const state = {
		metaSend: jest.fn( () => true ),
		googleSend: jest.fn( () => ( { ga4: true } ) ),
		googleAllowed: () => granted,
	};
	const fetch = jest.fn( async () => ( {
		ok: true,
		json: async () => ( {
			events: [
				{
					event_id: 'shared-order-id',
					platforms: {
						meta: {
							name: 'Purchase',
							params: {
								value: 10,
								contents: [ { id: '7', quantity: 1 } ],
							},
						},
						ga4: {
							name: 'purchase',
							params: {
								value: 10,
								items: [ { item_id: '7', quantity: 1 } ],
							},
						},
					},
				},
			],
		} ),
	} ) );
	const runtime = startCommerce(
		{
			commerce: {
				url: '/commerce',
				woo: { enabled: true, page: 'cart' },
			},
			meta: { enabled: true },
			ga4: { enabled: true },
		},
		state,
		consent,
		{ fetch }
	);
	await flush();
	expect( fetch ).not.toHaveBeenCalled();
	granted = true;
	consent.change();
	await flush();
	expect( state.metaSend ).toHaveBeenCalledWith(
		'Purchase',
		expect.objectContaining( { contents: expect.any( Array ) } ),
		'shared-order-id'
	);
	expect( state.googleSend ).toHaveBeenCalledWith(
		'purchase',
		expect.objectContaining( { items: expect.any( Array ) } ),
		'shared-order-id',
		[ 'ga4' ]
	);
	document.body.dispatchEvent(
		new CustomEvent( 'wc-blocks_added_to_cart', { bubbles: true } )
	);
	await flush();
	expect(
		fetch.mock.calls.some(
			( [ , options ] ) => JSON.parse( options.body ).action === 'pending'
		)
	).toBe( true );
	runtime.stop();
} );

test( 'consent withdrawal while commerce request is pending prevents dispatch', async () => {
	let granted = true;
	let respond;
	const consent = {
		read: () => ( { granted, source: 'integration' } ),
		subscribe: () => () => {},
	};
	const state = { metaSend: jest.fn() };
	const fetch = () =>
		new Promise( ( resolve ) => {
			respond = resolve;
		} );
	const runtime = startCommerce(
		{
			commerce: {
				url: '/commerce',
				woo: { enabled: true, page: 'cart' },
			},
			meta: { enabled: true },
		},
		state,
		consent,
		{ fetch }
	);
	await flush();
	granted = false;
	respond( {
		ok: true,
		json: async () => ( {
			events: [
				{
					event_id: 'id',
					platforms: { meta: { name: 'ViewCart', params: {} } },
				},
			],
		} ),
	} );
	await flush();
	expect( state.metaSend ).not.toHaveBeenCalled();
	runtime.stop();
} );

test( 'Blocks selected payment and confirmed shipping rates are observed once', async () => {
	let ready = false;
	let changed;
	let method = '';
	let rate = '';
	window.wp = {
		data: {
			subscribe: ( fn ) => {
				changed = fn;
				return () => {};
			},
			select: ( store ) =>
				store === 'wc/store/payment'
					? { getActivePaymentMethod: () => method }
					: {
							getShippingRates: () => [
								{
									shipping_rates: rate
										? [ { rate_id: rate, selected: true } ]
										: [],
								},
							],
						},
		},
	};
	const consent = {
		read: () => ( { granted: true, source: 'default' } ),
		subscribe: () => () => {},
	};
	const fetch = jest.fn( async () => ( {
		ok: true,
		json: async () => ( { events: [] } ),
	} ) );
	const runtime = startCommerce(
		{
			commerce: {
				url: '/commerce',
				woo: { enabled: true, page: 'begin_checkout' },
			},
			ga4: { enabled: true },
		},
		{
			metaSend: jest.fn(),
			googleAllowed: () => ready,
			googleSend: jest.fn(),
		},
		consent,
		{ fetch }
	);
	await flush();
	expect( changed ).toEqual( expect.any( Function ) );
	method = 'cod';
	rate = 'flat_rate:1';
	changed();
	await flush();
	changed();
	await flush();
	const bodies = fetch.mock.calls.map( ( [ , opts ] ) =>
		JSON.parse( opts.body )
	);
	expect( bodies.filter( ( b ) => b.action === 'add_payment_info' ) ).toEqual(
		[ expect.objectContaining( { payment_method: 'cod' } ) ]
	);
	expect(
		bodies.filter( ( b ) => b.action === 'add_shipping_info' )
	).toHaveLength( 1 );
	ready = true;
	runtime.refresh();
	await flush();
	const late = fetch.mock.calls
		.map( ( [ , opts ] ) => JSON.parse( opts.body ) )
		.filter(
			( body ) =>
				body.targets.includes( 'ga4' ) &&
				[ 'add_payment_info', 'add_shipping_info' ].includes(
					body.action
				)
		);
	expect( late ).toHaveLength( 2 );
	runtime.stop();
	delete window.wp;
} );
