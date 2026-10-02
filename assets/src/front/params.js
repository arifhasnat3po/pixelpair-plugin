/**
 * Bound the final scalar map, including context and expanded tokens.
 * @param {Object} input Parameter map.
 * @return {Object} At most 48 fields, 256 code points per string, 11 KB JSON.
 */
export function boundParams( input ) {
	const result = {};
	for ( const [ key, raw ] of Object.entries( input ).slice( 0, 48 ) ) {
		if (
			! [ 'string', 'boolean', 'number' ].includes( typeof raw ) ||
			( typeof raw === 'number' && ! Number.isFinite( raw ) )
		) {
			continue;
		}
		const safe =
			typeof raw === 'string' && /^https?:\/\//i.test( raw )
				? publicUrl( raw )
				: raw;
		let value =
			typeof raw === 'string'
				? Array.from( safe ).slice( 0, 256 ).join( '' )
				: raw;
		while (
			new Blob( [ JSON.stringify( { ...result, [ key ]: value } ) ] )
				.size > 11000
		) {
			if ( typeof value !== 'string' || ! value.length ) {
				return result;
			}
			value = Array.from( value )
				.slice( 0, Math.floor( Array.from( value ).length / 2 ) )
				.join( '' );
		}
		result[ key ] = value;
	}
	return result;
}

/**
 * Remove known receipt credentials before explicit vendor dispatch.
 * @param {string} value URL.
 * @return {string} Redacted URL.
 */
export function publicUrl( value ) {
	try {
		const url = new URL( value );
		url.hash = '';
		for ( const key of Array.from( url.searchParams.keys() ) ) {
			if (
				[
					'key',
					'payment_key',
					'order',
					'token',
					'password',
					'email',
					'_wpnonce',
					'nonce',
					'receipt',
				].includes( key.toLowerCase() )
			) {
				url.searchParams.delete( key );
			}
		}
		return url.href;
	} catch {
		return '';
	}
}
