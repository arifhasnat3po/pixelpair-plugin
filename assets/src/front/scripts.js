import { createConsent } from './consent';

/**
 * Insert only site-owner markup after category and visitor checks.
 * @param {Object} services Tracking dependencies.
 */
export function startScripts( services = {} ) {
	const cleanup = [];
	const fetcher = services.fetch || window.fetch?.bind( window );
	for ( const anchor of document.querySelectorAll(
		'script.pixelpair-script-slot[type="application/json"]'
	) ) {
		let config;
		try {
			config = JSON.parse( anchor.textContent );
		} catch {
			continue;
		}
		const consent = createConsent( config.consent );
		let stopped = false;
		for ( const row of config.rows || [] ) {
			let done = false,
				pending = false,
				abort;
			const attempt = async () => {
				if ( stopped || done ) {
					return;
				}
				if ( ! consent.read( row.consent ).granted ) {
					abort?.abort();
					return;
				}
				const mobile =
					window.matchMedia?.( '(max-width: 767px)' ).matches ||
					false;
				if (
					( row.device === 'mobile' && ! mobile ) ||
					( row.device === 'desktop' && mobile ) ||
					pending
				) {
					return;
				}
				pending = true;
				try {
					let code = row.code;
					if ( row.receipt || config.gate?.required ) {
						if ( ! fetcher ) {
							return;
						}
						abort = new AbortController();
						let timer;
						const data = await Promise.race( [
							fetcher( row.receipt || config.gate.url, {
								method: 'POST',
								credentials: 'same-origin',
								cache: 'no-store',
								headers: { 'Content-Type': 'application/json' },
								signal: abort.signal,
								body: JSON.stringify( {
									url: window.location.href,
									category: row.consent,
									consent: consent.read( row.consent ),
								} ),
							} ).then( ( r ) => ( r.ok ? r.json() : null ) ),
							new Promise( ( resolve ) => {
								timer = setTimeout( () => {
									abort.abort();
									resolve( null );
								}, 5000 );
							} ),
						] ).finally( () => clearTimeout( timer ) );
						if ( ! data || ( ! row.receipt && ! data.allowed ) ) {
							return;
						}
						if ( row.receipt ) {
							code = data.code;
						}
					}
					if (
						stopped ||
						! consent.read( row.consent ).granted ||
						! code
					) {
						return;
					}
					done = true;
					const template = document.createElement( 'template' );
					template.innerHTML = code;
					for ( const old of template.content.querySelectorAll(
						'script'
					) ) {
						const script = document.createElement( 'script' );
						for ( const attr of old.attributes ) {
							script.setAttribute( attr.name, attr.value );
						}
						if ( ! old.hasAttribute( 'async' ) ) {
							script.async = false;
						}
						script.textContent = old.textContent;
						old.replaceWith( script );
					}
					anchor.parentNode.insertBefore( template.content, anchor );
				} catch {
					/* Denied or failed eligibility leaves markup inert. */
				} finally {
					pending = false;
				}
			};
			cleanup.push( consent.subscribe( attempt ), () => abort?.abort() );
			attempt();
		}
		cleanup.push( () => {
			stopped = true;
		} );
	}
	return () => cleanup.forEach( ( fn ) => fn() );
}
