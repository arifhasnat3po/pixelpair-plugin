import { logsCsv, logMatchState } from '../../../assets/src/admin/data/logs';
test( 'CSV quotes cells and neutralizes formulas including whitespace-prefixed formulas', () => {
	const result = logsCsv( [
		{
			created_at: 1700000000,
			platform: 'meta',
			event_name: ' =SUM(A1)',
			status: 'sent',
			response_code: 200,
		},
	] );
	expect( result ).toContain( '"\' =SUM(A1)"' );
} );
test( 'cancelled and retrying server events do not imply failed browser matching', () => {
	expect( logMatchState( 'cancelled' ) ).toBe( 'unverified' );
	expect( logMatchState( 'retry' ) ).toBe( 'unverified' );
	expect( logMatchState( 'sent' ) ).toBe( 'accepted' );
} );
