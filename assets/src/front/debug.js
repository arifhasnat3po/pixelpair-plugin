/**
 * Record event identity only after uncached administrator authorization.
 * @param {Object} config   Public flags.
 * @param {Object} state    Runtime state.
 * @param {Object} services Browser dependencies.
 */
export function startDebug( config, state, services = {} ) {
	if ( ! config.debug_url ) {
		return;
	}
	const fetcher = services.fetch || window.fetch?.bind( window );
	if ( ! fetcher ) {
		return;
	}
	let allowed = false,
		hide = false,
		pending = [];
	const print = ( row ) => {
		// eslint-disable-next-line no-console -- Explicit authorized debug mode; never payloads.
		console.table( [ { source: hide ? 'Event' : 'PixelPair', ...row } ] );
	};
	state.debug = ( platform, event, id ) => {
		const row = { platform, event, id };
		if ( allowed ) {
			print( row );
		} else if ( pending.length < 50 ) {
			pending.push( row );
		}
	};
	fetcher( config.debug_url, {
		credentials: 'same-origin',
		cache: 'no-store',
	} )
		.then( ( r ) => ( r.ok ? r.json() : null ) )
		.then( ( result ) => {
			if ( result?.success ) {
				allowed = true;
				hide = !! result.data.hide_name;
				pending.forEach( print );
			} else {
				state.debug = () => {};
			}
			pending = [];
		} )
		.catch( () => {
			state.debug = () => {};
			pending = [];
		} );
}
