import { startTikTok } from './tiktok';
import { startDebug } from './debug';
import { createConsent } from './consent';
import { uuid } from './uuid';
import { sendEvent } from './transport';
import { startGoogle } from './google';
import { createEvents } from './events';
import { actionConsent } from './action-consent';

/**
 * Start one PageView lifecycle for this document.
 *
 * @param {Object} config   Site-level PHP configuration.
 * @param {Object} services Optional browser service overrides for testing.
 * @return {Object|undefined} Runtime state for this document.
 */
export function startTracker( config, services = {} ) {
	if (
		window.pixelpairRuntime ||
		! (
			config?.action_consent_only ||
			config?.meta?.enabled ||
			config?.ga4?.enabled ||
			config?.gtm?.enabled ||
			config?.tiktok?.enabled
		)
	) {
		return window.pixelpairRuntime;
	}
	if (
		( config.bots || [] ).some(
			( pattern ) =>
				pattern &&
				navigator.userAgent
					.toLowerCase()
					.includes( pattern.toLowerCase() )
		)
	) {
		return;
	}
	const consent = createConsent( config.consent );
	const fetch = services.fetch || window.fetch?.bind( window );
	const state = {
		eventId: null,
		fired: false,
		stopped: false,
		pending: false,
		stop: null,
	};
	window.pixelpairRuntime = state;
	startDebug( config, state, services );
	const stopActionConsent = actionConsent( consent );
	if ( config.action_consent_only ) {
		state.stop = stopActionConsent;
		return state;
	}
	const events = createEvents( config, state, consent, services );
	state.onReady = events.start;
	state.params = events.params;
	const stopGoogle =
		config.ga4?.enabled || config.gtm?.enabled
			? startGoogle(
					config,
					consent,
					state,
					() => uuid( services.crypto || window.crypto ),
					fetch
				)
			: () => {};
	const stopTikTok = config.tiktok?.enabled
		? startTikTok( config, consent, state, services )
		: () => {};
	let generation = 0;
	let controller;
	let loading;
	let loaded = false;
	let cleanupLoader = () => {};

	const loadMeta = () => {
		if ( loaded || typeof window.fbq?.callMethod === 'function' ) {
			return Promise.resolve( true );
		}
		if ( loading ) {
			return loading;
		}
		// VERIFY: Meta's official loader requires an empty fbq queue before SDK execution.
		// No init or event enters that queue until the SDK loads and consent is rechecked.
		if ( ! window.fbq ) {
			const fbq = function () {
				if ( fbq.callMethod ) {
					fbq.callMethod.apply( fbq, arguments );
				} else {
					fbq.queue.push( arguments );
				}
			};
			fbq.queue = [];
			fbq.push = fbq;
			fbq.loaded = true;
			fbq.version = '2.0';
			window.fbq = fbq;
			if ( ! window._fbq ) {
				window._fbq = fbq;
			}
		}
		loading = new Promise( ( resolve ) => {
			const existing = Array.from( document.scripts ).find(
				( script ) => script.src === config.meta_script_url
			);
			const script = existing || document.createElement( 'script' );
			const done = ( success ) => {
				cleanupLoader();
				loaded = success;
				resolve( success );
			};
			const onLoad = () => done( true );
			const onError = () => done( false );
			const timer = setTimeout( onError, 10000 );
			cleanupLoader = () => {
				clearTimeout( timer );
				script.removeEventListener( 'load', onLoad );
				script.removeEventListener( 'error', onError );
			};
			script.addEventListener( 'load', onLoad, { once: true } );
			script.addEventListener( 'error', onError, { once: true } );
			if ( ! existing ) {
				script.async = true;
				script.src = config.meta_script_url;
				document.head.appendChild( script );
			}
		} );
		return loading;
	};

	const eligibility = async ( decision ) => {
		if ( ! config.gate?.required ) {
			return config.meta;
		}
		if ( ! fetch ) {
			return null;
		}
		controller = new AbortController();
		let timer;
		try {
			const data = await Promise.race( [
				fetch( config.gate.url, {
					method: 'POST',
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( {
						url: window.location.href.split( '#' )[ 0 ],
						consent: decision,
					} ),
					signal: controller.signal,
				} ).then( ( response ) =>
					response.ok ? response.json() : null
				),
				new Promise( ( resolve ) => {
					timer = setTimeout( () => {
						controller.abort();
						resolve( null );
					}, 5000 );
				} ),
			] );
			if ( ! data ) {
				return null;
			}
			return data.allowed === true && data.marketing_allowed === true
				? data.meta
				: null;
		} catch {
			return null;
		} finally {
			clearTimeout( timer );
		}
	};

	const attempt = async () => {
		if ( ! config.meta?.enabled ) {
			return;
		}
		const decision = consent.read();
		if ( ! decision.granted ) {
			++generation;
			controller?.abort();
			return;
		}
		if ( state.stopped || state.fired || state.pending ) {
			return;
		}
		state.pending = true;
		const current = generation;
		try {
			const meta = await eligibility( decision );
			if (
				current !== generation ||
				state.stopped ||
				! consent.read().granted ||
				! meta?.enabled ||
				! /^\d{15,16}$/.test( meta.pixel_id )
			) {
				return;
			}
			let matching;
			if ( config.advanced_matching && config.identity_url && fetch ) {
				const identityAbort = new AbortController();
				const identityTimer = setTimeout(
					() => identityAbort.abort(),
					3000
				);
				try {
					const response = await fetch( config.identity_url, {
						method: 'POST',
						credentials: 'same-origin',
						signal: identityAbort.signal,
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify( {
							url: window.location.href,
							consent: decision,
						} ),
					} );
					if ( response.ok ) {
						matching = ( await response.json() ).matching;
					}
				} catch {
					/* Matching is optional; a failure never changes eligibility. */
				} finally {
					clearTimeout( identityTimer );
				}
				if (
					current !== generation ||
					! consent.read().granted ||
					state.stopped
				) {
					return;
				}
			}
			state.eventId =
				state.eventId || uuid( services.crypto || window.crypto );
			if ( ! state.eventId || ! config.meta_script_url ) {
				return;
			}
			if (
				! ( await loadMeta() ) ||
				current !== generation ||
				state.stopped ||
				! consent.read().granted ||
				state.fired
			) {
				return;
			}
			state.fired = true;
			if ( config.meta_ldu ) {
				window.fbq( 'dataProcessingOptions', [ 'LDU' ], 0, 0 );
			}
			if ( matching && Object.keys( matching ).length ) {
				window.fbq( 'init', meta.pixel_id, matching );
			} else {
				window.fbq( 'init', meta.pixel_id );
			}
			// VERIFY: eventID is Meta's fourth-argument deduplication option.
			state.metaSend = ( name, params, id ) => {
				if ( state.stopped || ! consent.read().granted ) {
					return false;
				}
				const standard = [
					'PageView',
					'Search',
					'Lead',
					'CompleteRegistration',
					'ViewContent',
					'AddToCart',
					'InitiateCheckout',
					'AddPaymentInfo',
					'Purchase',
					'Contact',
					'Subscribe',
					'SubmitApplication',
					'Schedule',
					'Donate',
					'StartTrial',
					'AddToWishlist',
					'CustomizeProduct',
					'FindLocation',
				];
				window.fbq(
					standard.includes( name ) ? 'track' : 'trackCustom',
					name,
					params,
					{ eventID: id }
				);
				state.debug?.( 'meta', name, id );
				return true;
			};
			const mapping = config.automatic?.page_view?.platforms?.meta || {
				name: 'PageView',
				server: true,
			};
			let pageParams = events.params( {}, mapping );
			if ( config.meta_sensitive_data ) {
				pageParams = {};
			}
			state.metaSend( mapping.name, pageParams, state.eventId );
			if ( config.capi_enabled && mapping.server ) {
				sendEvent(
					config,
					'page_view',
					state.eventId,
					{
						...pageParams,
						...( document.referrer
							? { referrer_url: document.referrer }
							: {} ),
					},
					consent.read(),
					services,
					undefined,
					mapping.name
				);
			}
		} catch {
			/* A failed dependency must never trigger an ungated fallback. */
		} finally {
			state.pending = false;
			events.start();
			// A new grant can arrive while a revoked attempt is still awaiting the SDK.
			if (
				current !== generation &&
				! state.stopped &&
				! state.fired &&
				consent.read().granted
			) {
				attempt();
			}
		}
	};
	const unsubscribe = consent.subscribe( attempt );
	state.stop = () => {
		events.stop();
		stopActionConsent();
		stopGoogle();
		stopTikTok();
		state.stopped = true;
		++generation;
		controller?.abort();
		unsubscribe();
		cleanupLoader();
	};
	attempt();
	return state;
}
