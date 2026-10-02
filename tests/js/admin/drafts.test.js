import { renderHook, act } from '@testing-library/react';
import { useDraft } from '../../../assets/src/admin/data/useDraft';

test( 'saves only changed owned keys and preserves a rejected draft', async () => {
	const writes = [];
	const save = async ( values ) => {
		writes.push( values );
		return false;
	};
	const { result } = renderHook( () =>
		useDraft(
			{
				meta_enabled: false,
				meta_pixel_id: '123456789012345',
				strict_cache_mode: true,
			},
			[ 'meta_enabled', 'meta_pixel_id' ],
			save
		)
	);
	act( () => result.current.change( 'meta_enabled', true ) );
	await act( async () => {
		await result.current.submit();
	} );
	expect( writes ).toEqual( [ { meta_enabled: true } ] );
	expect( result.current.dirty ).toBe( true );
	expect( result.current.values.meta_enabled ).toBe( true );
	act( () => result.current.discard() );
	expect( result.current.values.meta_enabled ).toBe( false );
	expect( result.current.dirty ).toBe( false );
} );

test( 'successful save clears dirty state without posting unrelated settings', async () => {
	const { result } = renderHook( () =>
		useDraft( { id: 'old', other: 1 }, [ 'id' ], async () => true )
	);
	act( () => result.current.change( 'id', 'new' ) );
	await act( async () => {
		await result.current.submit();
	} );
	expect( result.current.dirty ).toBe( false );
	expect( result.current.message ).toBe( 'Changes saved' );
} );

test( 'a normalized save response replaces the draft after the request finishes', async () => {
	let finish;
	const save = () =>
		new Promise( ( resolve ) => {
			finish = resolve;
		} );
	const { result, rerender } = renderHook(
		( { settings } ) => useDraft( settings, [ 'id' ], save ),
		{ initialProps: { settings: { id: 'old' } } }
	);
	act( () => result.current.change( 'id', ' padded ' ) );
	let pending;
	act( () => {
		pending = result.current.submit();
	} );
	rerender( { settings: { id: 'padded' } } );
	await act( async () => {
		finish( true );
		await pending;
	} );
	expect( result.current.values.id ).toBe( 'padded' );
	expect( result.current.dirty ).toBe( false );
} );
