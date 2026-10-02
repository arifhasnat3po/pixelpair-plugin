import { __ } from '@wordpress/i18n';
export const logStatuses = {
	sent: [ 'success', __( 'Sent', 'pixelpair' ) ],
	retry: [ 'warning', __( 'Retry scheduled', 'pixelpair' ) ],
	failed: [ 'error', __( 'Failed', 'pixelpair' ) ],
	cancelled: [ 'neutral', __( 'Cancelled', 'pixelpair' ) ],
};
export const logMatchState = ( status ) =>
	( { sent: 'accepted', failed: 'failed' } )[ status ] || 'unverified';
export function logDetails( value ) {
	try {
		return JSON.stringify( JSON.parse( value ), null, 2 );
	} catch {
		return __( 'Details unavailable for this event.', 'pixelpair' );
	}
}
export function logsCsv( items ) {
	const rows = [
		[ 'Time', 'Connection', 'Event', 'Status', 'HTTP' ],
		...items.map( ( row ) => [
			new Date( Number( row.created_at ) * 1000 ).toISOString(),
			row.platform,
			row.event_name,
			row.status,
			row.response_code,
		] ),
	];
	return rows
		.map( ( row ) =>
			row
				.map(
					( value ) =>
						'"' +
						String( value )
							.replace( /^(\s*[=+@-])/, "'$1" )
							.replaceAll( '"', '""' ) +
						'"'
				)
				.join( ',' )
		)
		.join( '\r\n' );
}
