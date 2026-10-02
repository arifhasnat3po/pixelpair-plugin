import { createContext } from '../../../assets/src/front/context';
import { createEvents } from '../../../assets/src/front/events';

afterEach( () => {
	sessionStorage.clear();
	document.cookie = 'previous_pending=; Max-Age=0; path=/';
} );

test( 'consented session context and once-per-session markers retain continuity', () => {
	sessionStorage.setItem(
		'previous_session',
		JSON.stringify( {
			count: 3,
			landing_page: 'https://example.test/first',
		} )
	);
	sessionStorage.setItem( 'previous_rule_7', '1' );
	const config = {
		migration: {
			session: 'previous_session',
			rule_prefix: 'previous_rule_',
		},
		context_parameters: [ 'landing_page' ],
	};
	expect( createContext( config ) ).toMatchObject( {
		session_count: 4,
		landing_page: 'https://example.test/first',
	} );
	expect( sessionStorage.getItem( 'pixelpair_rule_7' ) ).toBe( '1' );
	expect( sessionStorage.getItem( 'previous_session' ) ).toBeNull();
	expect( sessionStorage.getItem( 'previous_rule_7' ) ).toBeNull();
	expect( createContext( config ).session_count ).toBe( 5 );
} );

test( 'legacy pending hint requests authenticated action context after consent', () => {
	document.cookie = 'previous_pending=1; path=/';
	const fetch = jest.fn( () =>
		Promise.resolve( {
			ok: true,
			json: () => Promise.resolve( { roles: [], flags: [] } ),
		} )
	);
	const events = createEvents(
		{
			migration: { pending_cookie: 'previous_pending' },
			context_url: '/context',
		},
		{ metaSend: jest.fn() },
		{ read: () => ( { granted: true } ), subscribe: () => () => {} },
		{ fetch }
	);
	events.start();
	expect( fetch ).toHaveBeenCalledWith(
		'/context',
		expect.objectContaining( {
			method: 'POST',
			credentials: 'same-origin',
			cache: 'no-store',
		} )
	);
	events.stop();
} );
