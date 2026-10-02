import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

// Keep existing data on retry and ignore responses from an obsolete request.
export function useResource( path, initial = null ) {
	const [ data, setData ] = useState( initial );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( '' );
	const generation = useRef( 0 );
	const refresh = useCallback( async () => {
		const current = ++generation.current;
		setLoading( true );
		setError( '' );
		try {
			const result = await apiFetch( { path } );
			if ( current === generation.current ) {
				setData( result );
			}
			return result;
		} catch ( problem ) {
			if ( current === generation.current ) {
				setError(
					problem.message ||
						__(
							'Check your connection and try again.',
							'pixelpair'
						)
				);
			}
			return null;
		} finally {
			if ( current === generation.current ) {
				setLoading( false );
			}
		}
	}, [ path ] );
	useEffect( () => {
		refresh();
		return () => {
			// eslint-disable-next-line react-hooks/exhaustive-deps -- This is a request counter, not a DOM ref; invalidate all pending responses.
			++generation.current;
		};
	}, [ refresh ] );
	return { data, loading, error, refresh, setData };
}
