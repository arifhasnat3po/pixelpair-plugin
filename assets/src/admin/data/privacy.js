// Mirrors the existing PHP IP/CIDR bounds; the server remains authoritative.
export function validIpRange( value ) {
	const parts = value.split( '/' );
	const address = parts[ 0 ];
	if ( parts.length > 2 ) {
		return false;
	}
	const v6 = address.includes( ':' );
	let valid = false;
	if ( v6 && /^[a-fA-F0-9:.]+$/.test( address ) ) {
		try {
			valid = new URL( `http://[${ address }]/` ).hostname.startsWith(
				'['
			);
		} catch {
			valid = false;
		}
	} else if ( ! v6 ) {
		const octets = address.split( '.' );
		valid =
			octets.length === 4 &&
			octets.every(
				( part ) =>
					/^(0|[1-9][0-9]{0,2})$/.test( part ) &&
					Number( part ) <= 255
			);
	}
	return (
		valid &&
		( parts.length === 1 ||
			( /^[0-9]{1,3}$/.test( parts[ 1 ] ) &&
				Number( parts[ 1 ] ) <= ( v6 ? 128 : 32 ) ) )
	);
}
