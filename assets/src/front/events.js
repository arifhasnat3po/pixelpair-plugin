import { createContext, contextParams } from './context';
import { startAutomatic } from './automatic';
import { startRules, resolveParams } from './rules';
import { uuid } from './uuid';
import { sendEvent } from './transport';
import { boundParams } from './params';
import { startCommerce } from './commerce';

/**
 * Compose automatic and custom sources behind shared destination gates.
 * @param {Object} config   Public settings.
 * @param {Object} state    Document tracker state.
 * @param {Object} consent  Live category reader.
 * @param {Object} services Browser overrides.
 * @return {Object} Start, stop, context and parameter helpers.
 */
export function createEvents( config, state, consent, services ) {
	let context;
	let started = false;
	let stopped = false;
	const cleanup = [];
	let commerce;
	const getContext = () => {
		context = context || createContext( config );
		return context;
	};
	const params = ( values = {}, mapping = {} ) => {
		getContext().woo_cart_total = state.cartTotal;
		const data = {
			...contextParams( config, getContext() ),
			...values,
			...resolveParams( mapping.params || {}, getContext() ),
		};
		for ( const key of [
			'page_title',
			'post_type',
			'post_id',
			'categories',
			'tags',
			'landing_page',
			'traffic_source',
			'utm_source',
			'utm_medium',
			'utm_campaign',
			'utm_term',
			'utm_content',
		] ) {
			if ( ! config.context_parameters?.includes( key ) ) {
				delete data[ key ];
			}
		}
		return boundParams( data );
	};
	const canTrack = () =>
		! stopped &&
		! state.stopped &&
		( ( state.metaSend && consent.read().granted ) ||
			state.googleAllowed?.() ||
			( state.tiktokSend && consent.read().granted ) );
	const send = ( name, values = {}, extra = {} ) => {
		if ( ! canTrack() ) {
			return false;
		}
		const definition = extra.rule || config.automatic?.[ name ];
		if ( ! definition || definition.enabled === false ) {
			return false;
		}
		const eventId = uuid( services.crypto || window.crypto );
		if ( ! eventId ) {
			return false;
		}
		let sent = false;
		for ( const platform of [ 'meta', 'ga4', 'gtm', 'tiktok' ] ) {
			const mapping = definition.platforms?.[ platform ];
			if ( ! mapping?.enabled ) {
				continue;
			}
			let data = params( values, mapping );
			if ( platform === 'meta' ) {
				if ( config.meta_sensitive_data ) {
					data = Object.fromEntries(
						Object.entries( data ).filter( ( [ key ] ) =>
							[
								'value',
								'currency',
								'num_items',
								'percent_scrolled',
								'seconds',
							].includes( key )
						)
					);
				}
				if ( state.metaSend?.( mapping.name, data, eventId ) ) {
					sent = true;
					if ( config.capi_enabled && mapping.server ) {
						sendEvent(
							config,
							name,
							eventId,
							data,
							consent.read(),
							services,
							extra.matching,
							mapping.name
						);
					}
				}
			} else if ( platform === 'tiktok' ) {
				if ( state.tiktokSend?.( mapping.name, data, eventId ) ) {
					sent = true;
					if ( config.tiktok?.server && mapping.server ) {
						sendEvent(
							config,
							name,
							eventId,
							data,
							consent.read(),
							services,
							extra.matching,
							mapping.name,
							'tiktok'
						);
					}
				}
			} else {
				const google = state.googleSend?.(
					mapping.name,
					data,
					eventId,
					[ platform ]
				);
				sent = !! google?.[ platform ] || sent;
			}
		}
		return sent;
	};
	const start = () => {
		if ( started ) {
			commerce?.refresh();
			return;
		}
		if (
			started ||
			! canTrack() ||
			( state.pending && config.meta?.enabled && consent.read().granted )
		) {
			return;
		}
		started = true;
		commerce = startCommerce( config, state, consent, services );
		cleanup.push( commerce.stop );
		const current = getContext();
		cleanup.push(
			startAutomatic(
				{
					...config,
					canMatch: () =>
						config.advanced_matching &&
						config.capi_enabled &&
						!! state.metaSend &&
						consent.read().granted,
				},
				send,
				canTrack
			)
		);
		const rules = config.rules || [];
		const needsRoles = rules.some( ( rule ) =>
			rule.conditions.some( ( c ) => c.type === 'role' )
		);
		const hints = [
			'pixelpair_has_pending=1',
			config.migration?.pending_cookie
				? config.migration.pending_cookie + '=1'
				: '',
		];
		const pending = document.cookie
			.split( ';' )
			.some(
				( value ) => value.trim() && hints.includes( value.trim() )
			);
		const startCustom = async () => {
			if ( JSON.stringify( rules ).includes( '{woo_cart_total}' ) ) {
				await commerce.context();
				current.woo_cart_total = state.cartTotal;
			}
			if ( ! stopped ) {
				cleanup.push( startRules( rules, current, send, canTrack ) );
			}
		};
		if ( ( needsRoles || pending ) && config.context_url ) {
			const fetch = services.fetch || window.fetch?.bind( window );
			if ( ! fetch ) {
				startCustom();
				return;
			}
			const controller = new AbortController();
			const timer = setTimeout( () => controller.abort(), 5000 );
			cleanup.push( () => {
				clearTimeout( timer );
				controller.abort();
			} );
			const category = consent.read( 'statistics' ).granted
				? 'statistics'
				: 'marketing';
			fetch( config.context_url, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( {
					url: window.location.href,
					category,
					consent: consent.read( category ),
				} ),
				signal: controller.signal,
			} )
				.then( ( r ) => ( r.ok ? r.json() : null ) )
				.then( ( data ) => {
					if ( ! stopped && canTrack() && data ) {
						current.roles = data.roles;
						( data.flags || [] ).forEach( ( key ) =>
							send( key, {} )
						);
					}
				} )
				.catch( () => {} )
				.finally( () => {
					clearTimeout( timer );
					startCustom();
				} );
		} else {
			startCustom();
		}
	};
	return {
		start,
		params,
		context: getContext,
		send,
		stop: () => {
			stopped = true;
			cleanup.forEach( ( stop ) => stop() );
		},
	};
}
