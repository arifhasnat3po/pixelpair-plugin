/**
 * Resolve only the documented data tokens, as values.
 * @param {Object} params  Configured parameters.
 * @param {Object} context Runtime document context.
 * @return {Object} Resolved scalar parameters.
 */
export function resolveParams( params, context ) {
	const url = new URL( context.url || window.location.href );
	const values = {
		post_title: context.post_title || '',
		post_id: context.post_id || 0,
		post_type: context.post_type || '',
		page_url: url.href,
		woo_cart_total: context.woo_cart_total ?? '',
	};
	const token = ( key ) =>
		key.startsWith( 'url_param:' )
			? ( url.searchParams.get( key.slice( 10 ) ) || '' ).slice( 0, 512 )
			: ( values[ key ] ?? '' );
	return Object.fromEntries(
		Object.entries( params || {} ).map( ( [ key, value ] ) => {
			if ( typeof value !== 'string' ) {
				return [ key, value ];
			}
			const whole = value.match( /^\{([^{}]+)\}$/ );
			return [
				key,
				whole
					? token( whole[ 1 ] )
					: value.replace( /\{([^{}]+)\}/g, ( _, name ) =>
							String( token( name ) )
						),
			];
		} )
	);
}
/**
 * Test every condition; unresolved actor context cannot satisfy a role condition.
 * @param {Array}  conditions AND conditions.
 * @param {Object} context    Runtime context.
 * @return {boolean} Whether all conditions pass.
 */
export function matchesConditions( conditions, context ) {
	const url = new URL( context.url || window.location.href );
	return conditions.every( ( c ) => {
		switch ( c.type ) {
			case 'device':
				return c.value === context.device;
			case 'role':
				return (
					Array.isArray( context.roles ) &&
					( c.value === 'logged-out'
						? context.roles.length === 0
						: context.roles.includes( c.value ) )
				);
			case 'url_contains':
				return url.href.includes( c.value );
			case 'url_not_contains':
				return ! url.href.includes( c.value );
			case 'utm_source':
			case 'utm_medium':
			case 'utm_campaign':
				return url.searchParams.get( c.type ) === c.value;
			case 'referrer_domain':
				try {
					return (
						new URL( context.referrer ).hostname.toLowerCase() ===
						c.value.toLowerCase()
					);
				} catch {
					return false;
				}
			default:
				return false;
		}
	} );
}
/**
 * Compare a bounded URL using the validated operation.
 * @param {string} value   URL.
 * @param {Object} trigger URL matching rule.
 * @return {boolean} Match.
 */
export function matchUrl( value, trigger ) {
	if ( value.length > 4096 ) {
		return false;
	}
	switch ( trigger.operator ) {
		case 'equals':
			return value === trigger.value;
		case 'contains':
			return value.includes( trigger.value );
		case 'starts':
			return value.startsWith( trigger.value );
		case 'regex':
			try {
				return new RegExp( trigger.value ).test( value );
			} catch {
				return false;
			}
		default:
			return false;
	}
}
/**
 * Start declarative OR triggers, each behind AND conditions and the shared sender.
 * @param {Array}                                                     rules    Active compiled rules.
 * @param {Object}                                                    context  Visitor context obtained outside cached HTML.
 * @param {(name: string, params: Object, extra?: Object) => boolean} send     Gated dispatcher.
 * @param {() => boolean}                                             canTrack Whether any destination is eligible.
 * @return {() => void} Cleanup.
 */
export function startRules( rules, context, send, canTrack = () => true ) {
	const cleanup = [];
	let stopped = false;
	let seconds = 0;
	const timed = [];
	const url = new URL( context.url || window.location.href );
	const on = ( name, callback ) => {
		document.addEventListener( name, callback );
		cleanup.push( () => document.removeEventListener( name, callback ) );
	};
	const page = ( t ) => {
		switch ( t.type ) {
			case 'url':
				return matchUrl( url.href, t );
			case 'home':
				return context.home === true;
			case 'post_type':
				return context.post_type === t.value;
			case 'posts':
				return t.value
					.split( ',' )
					.includes( String( context.post_id ) );
			case 'terms':
				return context.term_ids?.includes( t.value );
			case 'page_count':
				return context.session_count >= t.value;
			case 'url_param':
				return t.operator === 'present'
					? url.searchParams.has( t.key )
					: url.searchParams.get( t.key ) === t.value;
			default:
				return false;
		}
	};
	rules.forEach( ( rule ) => {
		if ( ! matchesConditions( rule.conditions || [], context ) ) {
			return;
		}
		let fired = false;
		const key = 'pixelpair_rule_' + rule.id;
		if ( rule.once_per_session ) {
			try {
				if ( sessionStorage.getItem( key ) === '1' ) {
					return;
				}
			} catch {
				/* Fall back to once per document when storage is unavailable. */
			}
		}
		const fire = () => {
			if ( stopped || fired || ! canTrack() ) {
				return;
			}
			if ( send( 'custom_' + rule.id, {}, { rule } ) ) {
				fired = true;
				if ( rule.once_per_session ) {
					try {
						sessionStorage.setItem( key, '1' );
					} catch {
						/* No persistent state is required for a safe document-local limit. */
					}
				}
			}
		};
		( rule.triggers || [] ).forEach( ( t ) => {
			if ( page( t ) ) {
				if ( t.delay ) {
					timed.push( { at: t.delay, fire } );
				} else {
					fire();
				}
			}
			if ( t.type === 'time' ) {
				timed.push( { at: t.value, fire } );
			}
			if ( t.type === 'scroll' ) {
				const scroll = () => {
					const height = Math.max(
						document.documentElement.scrollHeight,
						document.body?.scrollHeight || 0
					);
					if (
						height &&
						( ( window.scrollY + window.innerHeight ) / height ) *
							100 >=
							t.value
					) {
						fire();
					}
				};
				window.addEventListener( 'scroll', scroll );
				cleanup.push( () =>
					window.removeEventListener( 'scroll', scroll )
				);
			}
			if ( [ 'click', 'link', 'mouseover' ].includes( t.type ) ) {
				on(
					t.type === 'mouseover' ? 'mouseover' : 'click',
					( event ) => {
						try {
							const element = event.target?.closest?.(
								t.type === 'link' ? 'a[href]' : t.value
							);
							if (
								element &&
								( t.type !== 'link' ||
									matchUrl( element.href, t ) )
							) {
								fire();
							}
						} catch {
							/* Stale selectors cannot break other rules. */
						}
					}
				);
			}
			if ( t.type === 'visible' && window.IntersectionObserver ) {
				try {
					const observer = new window.IntersectionObserver(
						( entries ) => {
							if (
								entries.some(
									( entry ) => entry.isIntersecting
								)
							) {
								fire();
							}
						},
						{ threshold: 0.01 }
					);
					document
						.querySelectorAll( t.value )
						.forEach( ( element ) => observer.observe( element ) );
					cleanup.push( () => observer.disconnect() );
				} catch {
					/* Ignore selectors removed or unsupported by this browser. */
				}
			}
		} );
	} );
	const timer = setInterval( () => {
		if ( ! document.hidden && canTrack() ) {
			++seconds;
			timed.forEach( ( item ) => {
				if ( seconds >= item.at ) {
					item.fire();
				}
			} );
		}
	}, 1000 );
	cleanup.push( () => clearInterval( timer ) );
	return () => {
		stopped = true;
		cleanup.forEach( ( stop ) => stop() );
	};
}
