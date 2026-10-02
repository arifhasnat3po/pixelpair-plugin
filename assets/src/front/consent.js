/**
 * Read marketing consent without creating cookies or guessing CMP cookie formats.
 *
 * @param {Object} config Site-level consent hints.
 * @return {Object} Reader and change subscription.
 */
export function createConsent( config = {} ) {
	const explicit = {};
	let cookieYes;
	const result = ( granted, source ) => ( {
		granted: granted === true,
		source,
	} );
	const read = ( category = 'marketing' ) => {
		if (
			category === 'marketing'
				? config.blocked
				: config.statistics_blocked
		) {
			return result( false, 'integration' );
		}
		if ( explicit[ category ] === false ) {
			return result( false, 'integration' );
		}
		try {
			if ( typeof window.wp_has_consent === 'function' ) {
				const type =
					window.wp_consent_type || window.wp_fallback_consent_type;
				if ( type !== 'optin' && type !== 'optout' ) {
					return result( false, 'unresolved' );
				}
				return result(
					( type === 'optin' || type === 'optout' ) &&
						window.wp_has_consent( category ),
					'wp-consent-api'
				);
			}
			if ( window.Cookiebot ) {
				if ( window.Cookiebot.hasResponse !== true ) {
					return result( false, 'unresolved' );
				}
				return result(
					window.Cookiebot.hasResponse === true &&
						window.Cookiebot.consent?.[ category ] === true,
					'cookiebot'
				);
			}
			if ( typeof window.cmplz_has_consent === 'function' ) {
				return result(
					window.cmplz_has_consent( category ),
					'complianz'
				);
			}
			if ( typeof window.getCkyConsent === 'function' ) {
				const value = window.getCkyConsent();
				if ( value?.isUserActionCompleted !== true ) {
					return result( false, 'unresolved' );
				}
				return result(
					value?.isUserActionCompleted === true &&
						value.categories?.[
							category === 'marketing'
								? 'advertisement'
								: 'analytics'
						] === true,
					'cookieyes'
				);
			}
			if ( cookieYes !== undefined ) {
				return result(
					cookieYes.includes(
						category === 'marketing' ? 'advertisement' : 'analytics'
					),
					'cookieyes'
				);
			}
			if ( window.BorlabsCookie ) {
				const service = config[ 'borlabs_' + category ];
				if (
					! service ||
					! window.BorlabsCookie.Consents?.hasConsent
				) {
					return result( false, 'unresolved' );
				}
				return result(
					!! service &&
						window.BorlabsCookie.Consents?.hasConsent( service ) ===
							true,
					'borlabs'
				);
			}
			if ( window.consentApi ) {
				const service = config[ 'rcb_' + category ];
				const value =
					service && window.consentApi.consentSync?.( service );
				if ( ! value?.cookie ) {
					return result( false, 'unresolved' );
				}
				return result(
					!! value?.cookie &&
						value.consentGiven === true &&
						value.cookieOptIn === true,
					'real-cookie-banner'
				);
			}
			if ( explicit[ category ] === true ) {
				return result( true, 'integration' );
			}
			if (
				config.tools?.length ||
				window.CookieYes ||
				window.BorlabsCookie ||
				window.consentApi
			) {
				return result( false, 'unresolved' );
			}
			return result( ! config.required, 'default' );
		} catch {
			return result( false, 'unresolved' );
		}
	};
	const subscribe = ( changed ) => {
		const custom = ( event ) => {
			[ 'marketing', 'statistics' ].forEach( ( category ) => {
				if ( typeof event.detail?.[ category ] === 'boolean' ) {
					explicit[ category ] = event.detail[ category ];
				}
			} );
			changed();
		};
		const yes = ( event ) => {
			if ( Array.isArray( event.detail?.accepted ) ) {
				cookieYes = event.detail.accepted;
				changed();
			}
		};
		const documentEvents = [
			'wp_listen_for_consent_change',
			'wp_consent_type_defined',
			'cmplz_status_change',
			'cmplz_enable_category',
			'cmplz_cookie_warning_loaded',
			'cmplz_revoke',
		];
		const windowEvents = [
			'borlabs-cookie-after-init',
			'borlabs-cookie-consent-saved',
			'cookieyes_banner_loaded',
			'CookiebotOnConsentReady',
			'CookiebotOnAccept',
			'CookiebotOnDecline',
			'wp_consent_type_defined',
		];
		documentEvents.forEach( ( name ) =>
			document.addEventListener( name, changed )
		);
		windowEvents.forEach( ( name ) =>
			window.addEventListener( name, changed )
		);
		document.addEventListener( 'pixelpair:consent', custom );
		document.addEventListener( 'cookieyes_consent_update', yes );
		// RCB's synchronous API covers withdrawal as well as grant. Poll only detected RCB installations.
		let previous = '';
		const timer = setInterval( () => {
			if (
				window.consentApi ||
				config.tools?.includes( 'real-cookie-banner' )
			) {
				const next = JSON.stringify( [ read(), read( 'statistics' ) ] );
				if ( next !== previous ) {
					previous = next;
					changed();
				}
			}
		}, 500 );
		return () => {
			clearInterval( timer );
			documentEvents.forEach( ( name ) =>
				document.removeEventListener( name, changed )
			);
			windowEvents.forEach( ( name ) =>
				window.removeEventListener( name, changed )
			);
			document.removeEventListener( 'pixelpair:consent', custom );
			document.removeEventListener( 'cookieyes_consent_update', yes );
		};
	};
	return { read, subscribe };
}
