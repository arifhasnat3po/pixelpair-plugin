/**
 * Subscribe to automatic browser events after the first permitted PageView.
 * @param {Object}                                                    config   Event options and public page context.
 * @param {(name: string, params: Object, extra?: Object) => boolean} send     Gated shared dispatcher.
 * @param {() => boolean}                                             canTrack Whether a configured destination currently allows tracking.
 * @return {() => void} Cleanup.
 */
export function startAutomatic( config, send, canTrack = () => true ) {
	const cleanups = [];
	const seen = new Set();
	let seconds = 0;
	let stopped = false;
	const enabled = ( key ) => config.automatic?.[ key ]?.enabled === true;
	const emit = ( key, params, ...extra ) =>
		enabled( key ) && canTrack() && send( key, params, ...extra );
	const once = ( key, params, suffix = '' ) => {
		const id = key + suffix;
		if ( ! seen.has( id ) && emit( key, params ) ) {
			seen.add( id );
		}
	};
	const on = ( target, name, callback ) => {
		target.addEventListener( name, callback );
		cleanups.push( () => target.removeEventListener( name, callback ) );
	};
	if ( config.page?.search_string ) {
		once( 'search', { search_string: config.page.search_string } );
	}
	if ( config.page?.not_found ) {
		once( 'not_found', {} );
	}
	const scroll = () => {
		const height = Math.max(
			document.documentElement.scrollHeight,
			document.body?.scrollHeight || 0
		);
		const percent = height
			? Math.min(
					100,
					( 100 * ( window.scrollY + window.innerHeight ) ) / height
				)
			: 0;
		( config.scroll_thresholds || [] ).forEach( ( n ) => {
			if ( percent >= n ) {
				once( 'scroll_depth', { percent_scrolled: n }, String( n ) );
			}
		} );
	};
	on( window, 'scroll', scroll );
	const timer = setInterval( () => {
		if ( ! document.hidden && canTrack() ) {
			++seconds;
			( config.time_thresholds || [] ).forEach( ( n ) => {
				if ( seconds >= n ) {
					once( 'time_on_page', { seconds: n }, String( n ) );
				}
			} );
		}
	}, 1000 );
	cleanups.push( () => clearInterval( timer ) );
	on( document, 'click', ( event ) => {
		const link = event.target?.closest?.( 'a[href]' );
		if ( ! link ) {
			return;
		}
		let url;
		try {
			url = new URL( link.href, window.location.href );
		} catch {
			return;
		}
		if ( ! [ 'http:', 'https:' ].includes( url.protocol ) ) {
			return;
		}
		const file = url.pathname.split( '/' ).pop();
		const extension = file.split( '.' ).pop().toLowerCase();
		if ( config.download_extensions?.includes( extension ) ) {
			emit( 'file_download', {
				file_name: file,
				file_extension: extension,
				link_url: url.href,
			} );
		}
		if ( url.origin !== window.location.origin ) {
			emit( 'outbound_link', {
				link_url: url.href,
				link_domain: url.hostname,
			} );
		}
	} );
	const known =
		'.wpcf7-form,.wpforms-form,.gform_wrapper form,.frm-fluent-form,.nf-form-cont form,.forminator-custom-form,.frm-show-form,.elementor-form';
	const excluded =
		'[role="search"],.search-form,#searchform,#loginform,#registerform,.woocommerce-checkout,.woocommerce-cart-form,.woocommerce-form-login,.woocommerce-form-register,form.cart,#commentform';
	const success = ( plugin, form, id ) => {
		if ( stopped || ! enabled( 'form_submit' ) || ! canTrack() ) {
			return;
		}
		const params = {
			form_plugin: plugin,
			form_id: String(
				id || form?.getAttribute( 'data-form-id' ) || form?.id || ''
			),
			form_title: (
				form?.getAttribute( 'aria-label' ) ||
				form?.getAttribute( 'name' ) ||
				''
			).slice( 0, 200 ),
		};
		if ( config.capture_form_fields && config.canMatch?.() && form ) {
			const raw = {
				em: form.querySelector( 'input[type="email"]' )?.value,
				ph: form.querySelector( 'input[type="tel"]' )?.value,
			};
			hashFields( raw ).then( ( matching ) => {
				if ( ! stopped && canTrack() ) {
					emit(
						'form_submit',
						params,
						config.canMatch?.() ? { matching } : {}
					);
				}
			} );
		} else {
			emit( 'form_submit', params );
		}
	};
	on( document, 'submit', ( event ) => {
		const form = event.target;
		if (
			! ( form instanceof window.HTMLFormElement ) ||
			form.matches( excluded ) ||
			form.closest( '.woocommerce,.wc-block-checkout,.wc-block-cart' ) ||
			form.matches( known ) ||
			form.querySelector(
				'input[type="search"],input[name="s"],input[type="password"]'
			)
		) {
			return;
		}
		success( 'fallback', form );
	} );
	on( document, 'wpcf7mailsent', ( event ) =>
		success(
			'contact-form-7',
			event.target?.matches?.( 'form' )
				? event.target
				: event.target?.querySelector?.( 'form' ),
			event.detail?.contactFormId
		)
	);
	let jq;
	let radio;
	const providers = {
		wpformsAjaxSubmitSuccess: 'wpforms',
		gform_confirmation_loaded: 'gravity-forms',
		fluentform_submission_success: 'fluent-forms',
		'forminator:form:submit:success': 'forminator',
		frmFormComplete: 'formidable',
		submit_success: 'elementor',
	};
	const attach = () => {
		if ( ! jq && typeof window.jQuery === 'function' ) {
			jq = window.jQuery;
			Object.entries( providers ).forEach( ( [ name, plugin ] ) => {
				const callback = ( event, first ) => {
					let form = event.target?.closest?.( 'form' );
					let id;
					if ( plugin === 'gravity-forms' ) {
						id = first;
						form = document.getElementById( 'gform_' + first );
					}
					if ( plugin === 'formidable' ) {
						form = first?.[ 0 ] || first || form;
					}
					if (
						plugin === 'elementor' &&
						! form?.matches?.( '.elementor-form' )
					) {
						return;
					}
					success( plugin, form, id );
				};
				jq( document ).on( name + '.pixelpair', callback );
				cleanups.push( () =>
					jq( document ).off( name + '.pixelpair', callback )
				);
			} );
		}
		if ( ! radio && window.Backbone?.Radio ) {
			radio = window.Backbone.Radio.channel( 'forms' );
			const ninja = ( response ) => {
				if (
					! response ||
					! response.data ||
					Object.keys( response.errors || {} ).length ||
					Object.keys( response.data.errors || {} ).length
				) {
					return;
				}
				const id = response.data.form_id;
				success(
					'ninja-forms',
					document.querySelector(
						'#nf-form-' + Number( id ) + '-cont form'
					),
					id
				);
			};
			radio.on( 'submit:response', ninja );
			cleanups.push( () => radio.off( 'submit:response', ninja ) );
		}
	};
	attach();
	const providerTimer = setInterval( attach, 1000 );
	cleanups.push( () => clearInterval( providerTimer ) );
	return () => {
		stopped = true;
		cleanups.forEach( ( cleanup ) => cleanup() );
	};
}

/**
 * Hash opt-in form matching values locally; raw values never become event params.
 * @param {Object} raw Email/phone values read only after consent.
 * @return {Promise<Object>} SHA-256 fields, or an empty map when unavailable.
 */
export async function hashFields( raw ) {
	const result = {};
	if ( ! window.crypto?.subtle ) {
		return result;
	}
	for ( const key of [ 'em', 'ph' ] ) {
		let value = String( raw[ key ] || '' )
			.trim()
			.toLowerCase();
		if ( key === 'ph' ) {
			value = value.replace( /\D/g, '' );
			if ( ! /^[1-9][0-9]{6,14}$/.test( value ) ) {
				continue;
			}
		} else if ( ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( value ) ) {
			continue;
		}
		let bytes;
		try {
			bytes = await window.crypto.subtle.digest(
				'SHA-256',
				new TextEncoder().encode( value )
			);
		} catch {
			return {};
		}
		result[ key ] = Array.from( new Uint8Array( bytes ) )
			.map( ( n ) => n.toString( 16 ).padStart( 2, '0' ) )
			.join( '' );
	}
	return result;
}
