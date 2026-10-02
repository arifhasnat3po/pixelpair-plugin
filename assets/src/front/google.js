/**
 * Keep commands inert until the SDK is ready and consent is checked again.
 * @param {Object} config  Public platform settings.
 * @param {Object} consent Category reader.
 * @return {Object} Readiness, sender and cleanup operations.
 */
export function createGoogle( config, consent ) {
	const initialized = new Set();
	const layers = new Set();
	const loading = new Map();
	const loaded = new Set();
	const cleanup = new Set();
	let stopped = false;
	const decision = ( category ) => {
		const v = consent.read( category );
		return (
			! stopped &&
			v.granted &&
			! ( config.google_consent?.denied && v.source === 'default' )
		);
	};
	const values = () => ( {
		ad_storage: decision( 'marketing' ) ? 'granted' : 'denied',
		analytics_storage: decision( 'statistics' ) ? 'granted' : 'denied',
		ad_user_data: decision( 'marketing' ) ? 'granted' : 'denied',
		ad_personalization: decision( 'marketing' ) ? 'granted' : 'denied',
	} );
	const denied = {
		ad_storage: 'denied',
		analytics_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
	};
	const queue = ( layer ) => {
		if ( ! Object.prototype.hasOwnProperty.call( window, layer ) ) {
			window[ layer ] = [];
		}
		return Array.isArray( window[ layer ] ) ? window[ layer ] : null;
	};
	const command = ( layer, ...args ) => {
		// Google consumes Arguments messages; native Arrays have different data-layer semantics.
		const push = function () {
			queue( layer )?.push( arguments );
		};
		push( ...args );
	};
	const prepare = ( layer ) => {
		if ( ! queue( layer ) ) {
			return false;
		}
		if ( ! layers.has( layer ) ) {
			command( layer, 'consent', 'default', {
				...denied,
				wait_for_update: config.google_consent?.wait ?? 500,
			} );
			layers.add( layer );
		}
		return true;
	};
	const url = ( id ) =>
		id === 'ga4'
			? 'https://www.googletagmanager.com/gtag/js?id=' +
				encodeURIComponent( config.ga4.ids[ 0 ] ) +
				'&l=' +
				encodeURIComponent( config.ga4.layer )
			: ( config.gtm.server_url || 'https://www.googletagmanager.com' ) +
				'/gtm.js?id=' +
				encodeURIComponent( config.gtm.id ) +
				'&l=' +
				encodeURIComponent( config.gtm.layer );
	const isReady = ( id ) => loaded.has( id ) && ! stopped;
	const load = ( id ) => {
		const platform = config[ id ];
		if (
			stopped ||
			! platform?.enabled ||
			! decision( 'statistics' ) ||
			( id === 'gtm' && ! decision( 'marketing' ) ) ||
			! prepare( platform.layer )
		) {
			return Promise.resolve( false );
		}
		if ( isReady( id ) ) {
			return Promise.resolve( true );
		}
		if ( loading.has( id ) ) {
			return loading.get( id );
		}
		if ( id === 'gtm' && platform.only ) {
			loaded.add( id );
			return Promise.resolve( true );
		}
		const pending = new Promise( ( resolve ) => {
			const src = url( id );
			const existing = Array.from( document.scripts ).find(
				( script ) => script.src === src
			);
			const script = existing || document.createElement( 'script' );
			let settled = false;
			const finish = ( success ) => {
				if ( settled ) {
					return;
				}
				settled = true;
				clearTimeout( timer );
				script.removeEventListener( 'load', onLoad );
				script.removeEventListener( 'error', onError );
				cleanup.delete( cancel );
				if ( success && ! stopped ) {
					loaded.add( id );
				} else if ( ! existing ) {
					script.remove();
				}
				resolve( success && ! stopped );
			};
			const onLoad = () => finish( true );
			const onError = () => finish( false );
			const cancel = () => finish( false );
			const timer = setTimeout( onError, 10000 );
			cleanup.add( cancel );
			script.addEventListener( 'load', onLoad, { once: true } );
			script.addEventListener( 'error', onError, { once: true } );
			if ( ! existing ) {
				script.async = true;
				script.src = src;
				document.head.appendChild( script );
			}
		} );
		loading.set( id, pending );
		return pending;
	};
	const ready = ( targets ) => Promise.all( targets.map( load ) );
	const update = () =>
		layers.forEach( ( layer ) =>
			command(
				layer,
				'consent',
				'update',
				Array.from( loaded ).some(
					( id ) => config[ id ]?.layer === layer
				)
					? values()
					: denied
			)
		);
	const send = ( name, params, eventId, targets = [ 'ga4', 'gtm' ] ) => {
		const sent = { ga4: false, gtm: false };
		const ga = config.ga4;
		const gtm = config.gtm;
		if (
			targets.includes( 'ga4' ) &&
			ga?.enabled &&
			isReady( 'ga4' ) &&
			decision( 'statistics' ) &&
			prepare( ga.layer )
		) {
			command( ga.layer, 'consent', 'update', values() );
			if ( ! initialized.has( 'ga4' ) ) {
				initialized.add( 'ga4' );
				command( ga.layer, 'js', new Date() );
				ga.ids.forEach( ( id ) =>
					command( ga.layer, 'config', id, {
						send_page_view: false,
						debug_mode: ga.debug === true,
						...( ga.server_url
							? { server_container_url: ga.server_url }
							: {} ),
					} )
				);
			}
			command( ga.layer, 'event', name, {
				...params,
				page_location: publicUrl( window.location.href ),
				page_referrer: document.referrer
					? publicUrl( document.referrer )
					: '',
				event_id: eventId,
				send_to: ga.ids,
			} );
			sent.ga4 = true;
		}
		if (
			targets.includes( 'gtm' ) &&
			gtm?.enabled &&
			isReady( 'gtm' ) &&
			decision( 'statistics' ) &&
			decision( 'marketing' ) &&
			prepare( gtm.layer )
		) {
			command( gtm.layer, 'consent', 'update', values() );
			if ( ! initialized.has( 'gtm' ) ) {
				initialized.add( 'gtm' );
				if ( ! gtm.only ) {
					queue( gtm.layer ).push( {
						'gtm.start': Date.now(),
						event: 'gtm.js',
					} );
				}
			}
			const ecommerce = params.items ? params : null;
			if ( ecommerce ) {
				queue( gtm.layer ).push( { ecommerce: null } );
			}
			queue( gtm.layer ).push( {
				event: 'pixelpair_' + name,
				pixelpair: { event_id: eventId, params },
				...( ecommerce ? { ecommerce } : {} ),
			} );
			sent.gtm = true;
		}
		return sent;
	};
	return {
		send,
		update,
		decision,
		ready,
		isReady,
		stop: () => {
			stopped = true;
			cleanup.forEach( ( cancel ) => cancel() );
		},
	};
}

/**
 * Start Google PageView after fresh category-specific eligibility, when required.
 * @param {Object}              config  Public configuration.
 * @param {Object}              consent Category reader.
 * @param {Object}              state   Shared document state.
 * @param {() => string|null}   makeId  Secure event ID factory.
 * @param {typeof window.fetch} fetch   Browser fetch.
 * @return {() => void} Cleanup.
 */
export function startGoogle( config, consent, state, makeId, fetch ) {
	const fresh = { ...config, ga4: { ...config.ga4 }, gtm: { ...config.gtm } };
	const google = createGoogle( fresh, consent );
	const fired = new Set();
	let generation = 0;
	let pending = false;
	let stopped = false;
	const controllers = new Set();
	const gate = async ( category ) => {
		if ( ! config.gate?.required ) {
			return config;
		}
		if ( ! fetch ) {
			return null;
		}
		const controller = new AbortController();
		controllers.add( controller );
		let timer;
		try {
			return await Promise.race( [
				fetch( config.gate.url, {
					method: 'POST',
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( {
						url: window.location.href.split( '#' )[ 0 ],
						category,
						consent: consent.read( category ),
					} ),
					signal: controller.signal,
				} ).then( ( r ) => ( r.ok ? r.json() : null ) ),
				new Promise( ( resolve ) => {
					timer = setTimeout( () => {
						controller.abort();
						resolve( null );
					}, 5000 );
				} ),
			] );
		} catch {
			return null;
		} finally {
			clearTimeout( timer );
			controllers.delete( controller );
		}
	};
	const attempt = async () => {
		const current = ++generation;
		google.update();
		fresh.ga4.enabled = false;
		fresh.gtm.enabled = false;
		if ( pending || stopped ) {
			return;
		}
		pending = true;
		try {
			const statistics = google.decision( 'statistics' );
			const marketing = google.decision( 'marketing' );
			if ( ! statistics ) {
				return;
			}
			const stats = await gate( 'statistics' );
			const ads =
				config.gtm?.enabled && marketing
					? await gate( 'marketing' )
					: null;
			if (
				current !== generation ||
				stopped ||
				! google.decision( 'statistics' )
			) {
				return;
			}
			fresh.ga4 = {
				...stats?.ga4,
				enabled: !! (
					stats?.ga4?.enabled &&
					( ! config.gate?.required || stats.allowed )
				),
			};
			fresh.gtm = {
				...ads?.gtm,
				enabled: !! (
					stats?.gtm?.enabled &&
					ads?.gtm?.enabled &&
					google.decision( 'marketing' ) &&
					( ! config.gate?.required ||
						( stats.allowed && ads.allowed ) )
				),
			};
			state.eventId = state.eventId || makeId();
			if ( ! state.eventId ) {
				return;
			}
			await google.ready(
				[ 'ga4', 'gtm' ].filter( ( id ) => fresh[ id ].enabled )
			);
			if (
				current !== generation ||
				stopped ||
				! google.decision( 'statistics' )
			) {
				return;
			}
			const targets = [ 'ga4', 'gtm' ].filter(
				( id ) => ! fired.has( id )
			);
			targets.forEach( ( id ) => {
				const mapping = config.automatic?.page_view?.platforms?.[
					id
				] || { name: 'page_view' };
				const sent = google.send(
					mapping.name,
					state.params?.( {}, mapping ) || {},
					state.eventId,
					[ id ]
				);
				if ( sent[ id ] ) {
					state.debug?.( id, mapping.name, state.eventId );
					fired.add( id );
				}
			} );
		} finally {
			pending = false;
			state.onReady?.();
			if ( current !== generation && ! stopped ) {
				attempt();
			}
		}
	};
	state.googleSend = ( ...args ) => {
		const result = google.send( ...args );
		for ( const platform of [ 'ga4', 'gtm' ] ) {
			if ( result?.[ platform ] ) {
				state.debug?.( platform, args[ 0 ], args[ 2 ] );
			}
		}
		return result;
	};
	state.googleReady = ( id ) =>
		! stopped &&
		google.isReady( id ) &&
		google.decision( 'statistics' ) &&
		( id !== 'gtm' || google.decision( 'marketing' ) );
	state.googleAllowed = () =>
		! stopped &&
		google.decision( 'statistics' ) &&
		( ( fresh.ga4.enabled && google.isReady( 'ga4' ) ) ||
			( fresh.gtm.enabled &&
				google.isReady( 'gtm' ) &&
				google.decision( 'marketing' ) ) );
	const unsubscribe = consent.subscribe( attempt );
	attempt();
	return () => {
		stopped = true;
		google.stop();
		++generation;
		controllers.forEach( ( controller ) => controller.abort() );
		unsubscribe();
	};
}
import { publicUrl } from './params';
