import { renderHook, act, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import { useResource } from '../../../assets/src/admin/data/useResource';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

test( 'ignores obsolete responses when a different resource is opened', async () => {
	let resolveOld;
	apiFetch.mockImplementationOnce(
		() =>
			new Promise( ( resolve ) => {
				resolveOld = resolve;
			} )
	);
	apiFetch.mockResolvedValueOnce( { name: 'Current' } );
	const { result, rerender } = renderHook(
		( { path } ) => useResource( path ),
		{ initialProps: { path: '/old' } }
	);
	rerender( { path: '/new' } );
	await waitFor( () =>
		expect( result.current.data ).toEqual( { name: 'Current' } )
	);
	await act( async () => resolveOld( { name: 'Obsolete' } ) );
	expect( result.current.data ).toEqual( { name: 'Current' } );
} );

test( 'retains usable content after a failed refresh and lets the user retry', async () => {
	apiFetch.mockResolvedValueOnce( { count: 1 } );
	const { result } = renderHook( () => useResource( '/events' ) );
	await waitFor( () => expect( result.current.loading ).toBe( false ) );
	apiFetch.mockRejectedValueOnce( new Error( 'Connection lost' ) );
	await act( async () => {
		await result.current.refresh();
	} );
	expect( result.current.data ).toEqual( { count: 1 } );
	expect( result.current.error ).toBe( 'Connection lost' );
	apiFetch.mockResolvedValueOnce( { count: 2 } );
	await act( async () => {
		await result.current.refresh();
	} );
	expect( result.current.data ).toEqual( { count: 2 } );
	expect( result.current.error ).toBe( '' );
} );
