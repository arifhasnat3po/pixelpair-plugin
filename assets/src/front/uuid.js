/**
 * Generate a fresh cryptographic UUID v4, or fail closed.
 *
 * @param {Crypto} source Browser cryptography provider.
 * @return {string|null} UUID, never a server-generated value.
 */
export function uuid( source = window.crypto ) {
	try {
		if ( typeof source?.randomUUID === 'function' ) {
			return source.randomUUID();
		}
		if ( typeof source?.getRandomValues !== 'function' ) {
			return null;
		}
		const bytes = source.getRandomValues( new Uint8Array( 16 ) );
		bytes[ 6 ] = ( bytes[ 6 ] % 16 ) + 64;
		bytes[ 8 ] = ( bytes[ 8 ] % 64 ) + 128;
		const hex = Array.from( bytes, ( byte ) =>
			byte.toString( 16 ).padStart( 2, '0' )
		).join( '' );
		return `${ hex.slice( 0, 8 ) }-${ hex.slice( 8, 12 ) }-${ hex.slice( 12, 16 ) }-${ hex.slice( 16, 20 ) }-${ hex.slice( 20 ) }`;
	} catch {
		return null;
	}
}
