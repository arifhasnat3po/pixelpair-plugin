import { uuid } from './uuid';

/**
 * Collect authoritative store snapshots only after consent and SDK readiness.
 * @param {Object} config   Public site configuration.
 * @param {Object} state    Ready platform adapters.
 * @param {Object} consent  Live consent reader.
 * @param {Object} services Browser service overrides.
 */
export function startCommerce( config, state, consent, services = {} ) {
	let stopped = false;
	const controllers = new Set();
	const active = new Set();
	const waiting = new Map();
	const identities = new Map();
	const completed = new Map();
	const withdrawals = new Set();
	let lastPayment = '';
	let lastShipping = '';
	const fetcher = services.fetch || window.fetch?.bind( window );
	const decisions = () => ( {
		marketing: consent.read(),
		statistics: consent.read( 'statistics' ),
	} );
	const targets = () =>
		[
			state.metaSend && consent.read().granted && 'meta',
			state.tiktokSend && consent.read().granted && 'tiktok',
			state.googleAllowed?.() &&
				( ! state.googleReady || state.googleReady( 'ga4' ) ) &&
				consent.read( 'statistics' ).granted &&
				config.ga4?.enabled &&
				'ga4',
			state.googleAllowed?.() &&
				( ! state.googleReady || state.googleReady( 'gtm' ) ) &&
				consent.read().granted &&
				consent.read( 'statistics' ).granted &&
				config.gtm?.enabled &&
				'gtm',
		].filter( Boolean );
	const attribution = () => {
		const query = new URLSearchParams( window.location.search );
		const result = {
			landing_page: window.location.origin + window.location.pathname,
			traffic_source: document.referrer.split( '?' )[ 0 ],
		};
		for ( const key of [
			'utm_source',
			'utm_medium',
			'utm_campaign',
			'utm_term',
			'utm_content',
			'fbclid',
			'ttclid',
			'gclid',
		] ) {
			if ( query.has( key ) ) {
				result[ key ] = query.get( key ).slice( 0, 256 );
			}
		}
		return result;
	};
	const request = async ( provider, action, extra = {}, fresh = false ) => {
		let ready = targets();
		if (
			stopped ||
			state.stopped ||
			! fetcher ||
			! config.commerce?.url ||
			! ready.length ||
			! action
		) {
			return;
		}
		const token =
			provider + ':' + action + ':' + ( extra.product_id || '' );
		if ( active.has( token ) ) {
			waiting.set( token, () =>
				request( provider, action, extra, fresh )
			);
			return;
		}
		if ( fresh ) {
			completed.delete( token );
		}
		ready = ready.filter(
			( destination ) => ! completed.get( token )?.has( destination )
		);
		if ( ! ready.length ) {
			return;
		}
		if ( fresh || ! identities.has( token ) ) {
			identities.set( token, uuid( services.crypto || window.crypto ) );
		}
		if ( ! identities.get( token ) ) {
			return;
		}
		active.add( token );
		const controller = new AbortController();
		controllers.add( controller );
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return -- Used in finally even when an aborted response returns early.
		const timer = setTimeout( () => controller.abort(), 5000 );
		try {
			const response = await fetcher( config.commerce.url, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify( {
					provider,
					action,
					url: window.location.href,
					event_id: identities.get( token ),
					targets: ready,
					consent: decisions(),
					attribution: attribution(),
					...extra,
				} ),
			} );
			const data = response.ok ? await response.json() : null;
			if ( stopped || state.stopped || controller.signal.aborted ) {
				return;
			}
			if ( data ) {
				completed.set(
					token,
					new Set( [ ...( completed.get( token ) || [] ), ...ready ] )
				);
			}
			const allowed = targets();
			for ( const event of data?.events || [] ) {
				for ( const [ platform, mapping ] of Object.entries(
					event.platforms || {}
				) ) {
					if ( ! allowed.includes( platform ) ) {
						continue;
					}
					if ( platform === 'meta' ) {
						state.metaSend(
							mapping.name,
							mapping.params,
							event.event_id
						);
					} else if ( platform === 'tiktok' ) {
						state.tiktokSend(
							mapping.name,
							mapping.params,
							event.event_id
						);
					} else {
						state.googleSend?.(
							mapping.name,
							mapping.params,
							event.event_id,
							[ platform ]
						);
					}
				}
			}
			if ( typeof data?.cart_total === 'number' ) {
				state.cartTotal = data.cart_total;
			}
			return data;
		} catch {
			/* A failed snapshot must never fall back to browser-provided totals. */
		} finally {
			clearTimeout( timer );
			controllers.delete( controller );
			active.delete( token );
			const retry = waiting.get( token );
			waiting.delete( token );
			retry?.();
		}
	};
	const remember = () => {
		if (
			! config.commerce?.woo?.enabled &&
			! config.commerce?.edd?.enabled
		) {
			return;
		}
		document.cookie =
			'pixelpair_commerce_consent=' +
			encodeURIComponent( JSON.stringify( decisions() ) ) +
			'; Path=/; SameSite=Lax; Max-Age=1800' +
			( window.location.protocol === 'https:' ? '; Secure' : '' );
	};
	const revokeReceipts = () => {
		const current = decisions();
		const denied = Object.values( current ).some(
			( decision ) =>
				! decision.granted && decision.source !== 'unresolved'
		);
		if ( stopped || ! fetcher || ! config.commerce?.url || ! denied ) {
			return;
		}
		for ( const provider of [ 'woo', 'edd' ] ) {
			const store = config.commerce[ provider ];
			const key =
				provider +
				':' +
				current.marketing.granted +
				':' +
				current.statistics.granted;
			if (
				! store?.enabled ||
				store.page !== 'purchase' ||
				withdrawals.has( key )
			) {
				continue;
			}
			const eventId = uuid( services.crypto || window.crypto );
			if ( ! eventId ) {
				continue;
			}
			withdrawals.add( key );
			const controller = new AbortController();
			controllers.add( controller );
			const timeout = setTimeout( () => controller.abort(), 5000 );
			Promise.resolve(
				fetcher( config.commerce.url, {
					method: 'POST',
					credentials: 'same-origin',
					cache: 'no-store',
					signal: controller.signal,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( {
						provider,
						action: 'purchase',
						url: window.location.href,
						event_id: eventId,
						targets: [],
						consent: current,
					} ),
				} )
			)
				.then( ( response ) => {
					if ( ! response.ok ) {
						withdrawals.delete( key );
					}
				} )
				.catch( () => withdrawals.delete( key ) )
				.finally( () => {
					clearTimeout( timeout );
					controllers.delete( controller );
				} );
		}
	};
	const refresh = () => {
		remember();
		revokeReceipts();
		for ( const provider of [ 'woo', 'edd' ] ) {
			const store = config.commerce?.[ provider ];
			if ( ! store?.enabled ) {
				continue;
			}
			const aliases = { cart: 'view_cart', checkout: 'begin_checkout' };
			request( provider, aliases[ store.page ] || store.page, {
				product_id: store.product_id || 0,
				product_ids: store.product_ids || [],
			} );
			request( provider, 'pending' );
		}
		readCheckout();
	};
	const change = () => {
		remember();
		if ( ! targets().length ) {
			controllers.forEach( ( c ) => c.abort() );
			revokeReceipts();
		} else {
			refresh();
		}
	};
	const added = () => request( 'woo', 'pending', {}, true );
	const eddAdded = () => request( 'edd', 'pending', {}, true );
	const eddChoice = ( event ) => {
		const node = event.target;
		if (
			! config.commerce?.edd?.enabled ||
			! node?.matches?.( '[name^="edd_options[price_id]"]' )
		) {
			return;
		}
		const id = Number(
			node.closest( '[data-download-id]' )?.dataset.downloadId ||
				config.commerce.edd.product_id
		);
		const price = Number( node.value );
		if ( id && Number.isInteger( price ) && price >= 0 ) {
			request(
				'edd',
				'view_item',
				{ product_id: id, price_id: price },
				true
			);
		}
	};
	const readCheckout = () => {
		if (
			targets().length &&
			config.commerce?.edd?.page === 'begin_checkout'
		) {
			const method = document.querySelector(
				'[name="payment-mode"]:checked, [name="edd-gateway"]'
			)?.value;
			if ( method ) {
				const fresh = method !== lastPayment;
				lastPayment = method;
				request(
					'edd',
					'add_payment_info',
					{ payment_method: method },
					fresh
				);
			}
		}
		if (
			! targets().length ||
			! [ 'checkout', 'begin_checkout' ].includes(
				config.commerce?.woo?.page
			)
		) {
			return;
		}
		let payment =
			document.querySelector( '[name="payment_method"]:checked' )
				?.value || '';
		let shipping = Array.from(
			document.querySelectorAll(
				'[name^="shipping_method"]:checked, input[type="hidden"][name^="shipping_method"]'
			)
		)
			.map( ( node ) => node.value )
			.join( ',' );
		try {
			payment =
				window.wp?.data
					?.select( 'wc/store/payment' )
					?.getActivePaymentMethod?.() || payment;
			const rates = window.wp?.data
				?.select( 'wc/store/cart' )
				?.getShippingRates?.();
			if ( rates?.length ) {
				shipping = rates
					.map(
						( pack ) =>
							( pack.shipping_rates || [] ).find(
								( rate ) => rate.selected
							)?.rate_id || ''
					)
					.filter( Boolean )
					.join( ',' );
			}
		} catch {
			/* Blocks stores are optional; classic controls remain available. */
		}
		if ( payment ) {
			const fresh = payment !== lastPayment;
			lastPayment = payment;
			request(
				'woo',
				'add_payment_info',
				{ payment_method: payment },
				fresh
			);
		}
		if ( shipping ) {
			const fresh = shipping !== lastShipping;
			lastShipping = shipping;
			request( 'woo', 'add_shipping_info', {}, fresh );
		}
	};
	const checkout = ( event ) => {
		if (
			event.target?.matches?.(
				'[name="payment_method"], [name="radio-control-wc-payment-method-options"]'
			)
		) {
			readCheckout();
		}
		// Shipping is read after WooCommerce confirms the selection, not before its update request.
	};
	const unsubscribe = consent.subscribe( change );
	const unsubscribeStore = window.wp?.data?.subscribe?.( readCheckout );
	document.body.addEventListener( 'wc-blocks_added_to_cart', added );
	document.addEventListener( 'change', checkout );
	document.addEventListener( 'change', eddChoice );
	const jq = window.jQuery;
	if ( jq ) {
		jq( document.body ).on( 'added_to_cart.pixelpair', added );
		jq( document.body ).on( 'edd_cart_item_added.pixelpair', eddAdded );
		jq( document.body ).on( 'edd_gateway_loaded.pixelpair', readCheckout );
		jq( document.body ).on( 'updated_checkout.pixelpair', readCheckout );
		jq( document ).on( 'found_variation.pixelpair', ( event, variation ) =>
			request( 'woo', 'view_item', {
				product_id: Number( variation?.variation_id ),
			} )
		);
	}
	refresh();
	return {
		refresh,
		context: () =>
			config.commerce?.woo?.enabled
				? request( 'woo', 'context' )
				: Promise.resolve(),
		stop: () => {
			stopped = true;
			controllers.forEach( ( c ) => c.abort() );
			unsubscribe();
			unsubscribeStore?.();
			document.body.removeEventListener(
				'wc-blocks_added_to_cart',
				added
			);
			document.removeEventListener( 'change', checkout );
			document.removeEventListener( 'change', eddChoice );
			if ( jq ) {
				jq( document.body ).off( '.pixelpair' );
				jq( document ).off( '.pixelpair' );
			}
		},
	};
}
