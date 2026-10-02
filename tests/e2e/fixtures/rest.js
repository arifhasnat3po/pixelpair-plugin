// WordPress supports both permalink and query-string REST URLs, with optional locale parameters.
function restRoute( path ) {
	return ( url ) => {
		const parsed = new URL( url );
		return (
			parsed.searchParams.get( 'rest_route' ) === path ||
			parsed.pathname.endsWith( `/wp-json${ path }` )
		);
	};
}
module.exports = { restRoute };
