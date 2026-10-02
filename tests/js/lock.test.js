const lock = require( '../../package-lock.json' );
test( 'locked package versions agree with their immutable npm tarball URLs', () => {
	for ( const [ name, value ] of Object.entries( lock.packages ).filter(
		( [ , v ] ) => v.resolved?.startsWith( 'https://registry.npmjs.org/' )
	) ) {
		expect( {
			name,
			versionMatches: decodeURIComponent( value.resolved ).endsWith(
				'-' + value.version + '.tgz'
			),
		} ).toEqual( { name, versionMatches: true } );
	}
} );
