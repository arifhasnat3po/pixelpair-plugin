/**
 * Create consented document/session context, never inline visitor data.
 * @param {Object} config Public document metadata and enabled fields.
 * @return {Object} Browser context.
 */
export function createContext( config ) {
	const page = config.page || {};
	const url = new URL( window.location.href );
	const fields = config.context_parameters || [];
	let session = { count: 0 };
	try {
		const keys = Object.keys( sessionStorage );
		keys.forEach( ( key ) => {
			let target;
			if ( key === config.migration?.session ) {
				target = 'pixelpair_session';
			} else if (
				config.migration?.rule_prefix &&
				key.startsWith( config.migration.rule_prefix )
			) {
				target =
					'pixelpair_rule_' +
					key.slice( config.migration.rule_prefix.length );
			}
			if ( target ) {
				if ( sessionStorage.getItem( target ) === null ) {
					sessionStorage.setItem(
						target,
						sessionStorage.getItem( key )
					);
				}
				sessionStorage.removeItem( key );
			}
		} );
		const old = JSON.parse(
			sessionStorage.getItem( 'pixelpair_session' ) || 'null'
		);
		if ( old && typeof old === 'object' && Number.isInteger( old.count ) ) {
			session = old;
		}
	} catch {
		/* Private browsing keeps only document-local context. */
	}
	session.count = Math.min( 100000, session.count + 1 );
	if ( fields.includes( 'landing_page' ) && ! session.landing_page ) {
		session.landing_page = url.href.slice( 0, 1024 );
	}
	if ( fields.includes( 'traffic_source' ) && ! session.traffic_source ) {
		try {
			session.traffic_source = document.referrer
				? new URL( document.referrer ).hostname
				: 'direct';
		} catch {
			session.traffic_source = 'direct';
		}
	}
	[
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_term',
		'utm_content',
	].forEach( ( key ) => {
		if (
			fields.includes( key ) &&
			! session[ key ] &&
			url.searchParams.has( key )
		) {
			session[ key ] = url.searchParams.get( key ).slice( 0, 256 );
		}
	} );
	try {
		sessionStorage.setItem(
			'pixelpair_session',
			JSON.stringify( session )
		);
	} catch {
		/* No tracking identity depends on storage availability. */
	}
	const width = window.innerWidth;
	let device = 'desktop';
	if ( width < 1024 ) {
		device = 'tablet';
	}
	if ( width < 768 ) {
		device = 'mobile';
	}
	return {
		...page,
		...session,
		url: url.href,
		referrer: document.referrer,
		device,
		session_count: session.count,
		page_title: page.post_title || document.title,
	};
}
/**
 * Include only owner-enabled context fields, as bounded scalars.
 * @param {Object} config  Site policy.
 * @param {Object} context Runtime context.
 * @return {Object} Event parameters.
 */
export function contextParams( config, context ) {
	return Object.fromEntries(
		( config.context_parameters || [] )
			.filter( ( key ) => context[ key ] !== undefined )
			.map( ( key ) => {
				let value = context[ key ];
				if ( Array.isArray( value ) ) {
					value = value.join( ',' );
				}
				if ( typeof value === 'string' ) {
					value = value.slice( 0, 1024 );
				}
				return [ key, value ];
			} )
	);
}
