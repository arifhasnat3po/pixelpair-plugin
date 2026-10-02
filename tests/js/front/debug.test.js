import { startDebug } from '../../../assets/src/front/debug';
import { publicUrl, boundParams } from '../../../assets/src/front/params';

test( 'debug remains silent for anonymous requests and prints identity only after authorization', async () => {
	const output = jest
		.spyOn( console, 'table' )
		.mockImplementation( () => {} );
	const state = {};
	try {
		startDebug( { debug_url: '/admin-ajax.php' }, state, {
			fetch: jest.fn().mockResolvedValue( { ok: false } ),
		} );
		state.debug( 'meta', 'Purchase', 'id' );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( output ).not.toHaveBeenCalled();
		const authorized = jest.fn();
		authorized.mockResolvedValue( {
			ok: true,
			json: async () => ( { success: true, data: { hide_name: true } } ),
		} );
		startDebug( { debug_url: '/admin-ajax.php' }, state, {
			fetch: authorized,
		} );
		state.debug( 'meta', 'Purchase', 'id' );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( output ).toHaveBeenCalledWith( [
			{ source: 'Event', platform: 'meta', event: 'Purchase', id: 'id' },
		] );
	} finally {
		output.mockRestore();
	}
} );
test( 'explicit event URLs remove receipt credentials and fragments', () => {
	const url =
		'https://example.test/receipt?payment_key=secret&key=private&campaign=autumn#hidden';
	expect( publicUrl( url ) ).toBe(
		'https://example.test/receipt?campaign=autumn'
	);
	expect( boundParams( { page_url: url } ) ).toEqual( {
		page_url: 'https://example.test/receipt?campaign=autumn',
	} );
} );
