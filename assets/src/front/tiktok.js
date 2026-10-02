import { uuid } from './uuid';
import { sendEvent } from './transport';

/**
 * Load the official SDK only after current marketing and visitor eligibility.
 * @param {Object} config   Tracking dependencies.
 * @param {Object} consent  Tracking dependencies.
 * @param {Object} state    Tracking dependencies.
 * @param {Object} services Tracking dependencies.
 */
export function startTikTok( config, consent, state, services = {} ) {
	let pending = false,
		loaded = false,
		fired = false,
		stopped = false,
		generation = 0,
		loading;
	let abort,
		cleanup = () => {};
	const fetcher = services.fetch || window.fetch?.bind( window );
	const load = ( pixel ) => {
		if ( loaded ) {
			return Promise.resolve( true );
		}
		if ( loading ) {
			return loading;
		}
		window.TiktokAnalyticsObject = 'ttq';
		const q = ( window.ttq = window.ttq || [] );
		q.methods = [
			'page',
			'track',
			'identify',
			'instances',
			'debug',
			'on',
			'off',
			'once',
			'ready',
			'alias',
			'group',
			'enableCookie',
			'disableCookie',
			'holdConsent',
			'revokeConsent',
			'grantConsent',
		];
		q.setAndDefer = ( target, method ) => {
			if ( ! target[ method ] ) {
				target[ method ] = ( ...args ) =>
					target.push( [ method, ...args ] );
			}
		};
		q.methods.forEach( ( method ) => q.setAndDefer( q, method ) );
		q.instance = ( id ) => {
			const instance = q._i[ id ] || [];
			q.methods.forEach( ( method ) =>
				q.setAndDefer( instance, method )
			);
			return instance;
		};
		q._i = q._i || {};
		q._i[ pixel ] = [];
		q._i[ pixel ]._u = config.tiktok.script_url;
		q._t = q._t || {};
		q._t[ pixel ] = Date.now();
		q._o = q._o || {};
		q._o[ pixel ] = {};
		q.holdConsent();
		loading = new Promise( ( resolve ) => {
			const script = document.createElement( 'script' );
			script.async = true;
			script.src =
				config.tiktok.script_url +
				'?sdkid=' +
				encodeURIComponent( pixel ) +
				'&lib=ttq';
			const done = ( ok ) => {
				cleanup();
				loaded = ok;
				resolve( ok );
			};
			const onLoad = () => done( true ),
				onError = () => done( false );
			const timer = setTimeout( onError, 10000 );
			cleanup = () => {
				clearTimeout( timer );
				script.removeEventListener( 'load', onLoad );
				script.removeEventListener( 'error', onError );
			};
			script.addEventListener( 'load', onLoad );
			script.addEventListener( 'error', onError );
			document.head.appendChild( script );
		} );
		return loading;
	};
	const attempt = async () => {
		if ( stopped || state.stopped ) {
			return;
		}
		if ( ! consent.read().granted ) {
			++generation;
			abort?.abort();
			window.ttq?.revokeConsent?.();
			return;
		}
		if ( fired ) {
			window.ttq?.grantConsent?.();
			return;
		}
		if ( pending ) {
			return;
		}
		pending = true;
		const current = generation;
		try {
			let platform = config.tiktok;
			if ( config.gate?.required ) {
				if ( ! fetcher ) {
					return;
				}
				abort = new AbortController();
				let timer;
				const data = await Promise.race( [
					fetcher( config.gate.url, {
						method: 'POST',
						credentials: 'same-origin',
						cache: 'no-store',
						headers: { 'Content-Type': 'application/json' },
						signal: abort.signal,
						body: JSON.stringify( {
							url: window.location.href,
							consent: consent.read(),
						} ),
					} ).then( ( r ) => ( r.ok ? r.json() : null ) ),
					new Promise( ( resolve ) => {
						timer = setTimeout( () => {
							abort.abort();
							resolve( null );
						}, 5000 );
					} ),
				] ).finally( () => clearTimeout( timer ) );
				if ( ! data?.allowed || ! data.marketing_allowed ) {
					return;
				}
				platform = data.tiktok;
			}
			if (
				! platform?.enabled ||
				! consent.read().granted ||
				current !== generation ||
				stopped
			) {
				return;
			}
			if (
				! ( await load( platform.pixel_id ) ) ||
				! consent.read().granted ||
				current !== generation ||
				stopped
			) {
				return;
			}
			state.eventId =
				state.eventId || uuid( services.crypto || window.crypto );
			if ( ! state.eventId ) {
				return;
			}
			window.ttq.grantConsent?.();
			if (
				platform.advanced_matching &&
				fetcher &&
				platform.identity_url
			) {
				const controller = new AbortController();
				const timer = setTimeout( () => controller.abort(), 3000 );
				try {
					const r = await fetcher( platform.identity_url, {
						method: 'POST',
						credentials: 'same-origin',
						signal: controller.signal,
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify( {
							url: window.location.href,
							consent: consent.read(),
						} ),
					} );
					const matching = r.ok ? ( await r.json() ).matching : null;
					if (
						matching &&
						consent.read().granted &&
						current === generation &&
						! stopped
					) {
						const user = {};
						for ( const [ from, to ] of [
							[ 'em', 'sha256_email' ],
							[ 'ph', 'sha256_phone_number' ],
							[ 'external_id', 'external_id' ],
						] ) {
							if (
								/^[a-f0-9]{64}$/.test( matching[ from ] || '' )
							) {
								user[ to ] = matching[ from ];
							}
						}
						if ( Object.keys( user ).length ) {
							window.ttq.identify( user );
						}
					}
				} catch {
					/* Matching is optional. */
				} finally {
					clearTimeout( timer );
				}
			}
			if (
				! consent.read().granted ||
				current !== generation ||
				stopped
			) {
				return;
			}
			state.tiktokSend = ( name, params, id ) => {
				if ( stopped || state.stopped || ! consent.read().granted ) {
					return false;
				}
				window.ttq.track( name, params, {
					event_id: id,
					pixel_code: platform.pixel_id,
				} );
				state.debug?.( 'tiktok', name, id );
				return true;
			};
			const mapping = config.automatic?.page_view?.platforms?.tiktok || {
				name: 'PageView',
				server: true,
			};
			const params = state.params?.( {}, mapping ) || {};
			fired = true;
			state.tiktokSend( mapping.name, params, state.eventId );
			if ( platform.server && mapping.server ) {
				sendEvent(
					config,
					'page_view',
					state.eventId,
					params,
					consent.read(),
					services,
					undefined,
					mapping.name,
					'tiktok'
				);
			}
			state.onReady?.();
		} catch {
			/* A blocked SDK or gate cannot authorize dispatch. */
		} finally {
			pending = false;
			if (
				current !== generation &&
				! fired &&
				! stopped &&
				consent.read().granted
			) {
				attempt();
			}
		}
	};
	const unsubscribe = consent.subscribe( attempt );
	attempt();
	return () => {
		stopped = true;
		++generation;
		abort?.abort();
		cleanup();
		unsubscribe();
	};
}
