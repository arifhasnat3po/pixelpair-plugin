const { restRoute } = require( '../../e2e/fixtures/rest' );
test.each( [
	'http://localhost:8888/wp-json/pixelpair/v1/events?_locale=user',
	'http://localhost:8898/?rest_route=/pixelpair/v1/events&_locale=user',
	'http://localhost:8898/?rest_route=%2Fpixelpair%2Fv1%2Fevents&_locale=user',
	'http://localhost/site/wp-json/pixelpair/v1/events',
] )( 'matches the event collection at %s', ( url ) =>
	expect( restRoute( '/pixelpair/v1/events' )( new URL( url ) ) ).toBe( true )
);
test( 'does not intercept individual rule updates or another endpoint', () => {
	expect(
		restRoute( '/pixelpair/v1/events' )(
			new URL(
				'http://localhost/wp-json/pixelpair/v1/events/7?_locale=user'
			)
		)
	).toBe( false );
	expect(
		restRoute( '/pixelpair/v1/events' )(
			new URL( 'http://localhost/?rest_route=/pixelpair/v1/settings' )
		)
	).toBe( false );
} );
