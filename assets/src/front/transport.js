import { boundParams } from './params';
/**
 * Send a consented event with the same ID used by the browser pixel.
 * @param {Object} config       Public configuration.
 * @param {string} name         Configured event key.
 * @param {string} id           Browser event UUID.
 * @param {Object} params       Event parameters.
 * @param {Object} consent      Current marketing decision.
 * @param {Object} services     Browser transport overrides.
 * @param {Object} matching     Optional consented SHA-256 form fields.
 * @param {string} expectedName Actual browser Meta name; validation only.
 * @param {string} platform     Destination.
 * @return {boolean} Whether a transport accepted the request.
 */
export function sendEvent(
	config,
	name,
	id,
	params,
	consent,
	services = {},
	matching,
	expectedName,
	platform = 'meta'
) {
	if ( ! config.event_url || ! consent?.granted ) {
		return false;
	}
	const body = JSON.stringify( {
		event_name: name,
		...( platform === 'tiktok' ? { platform } : {} ),
		expected_name: expectedName,
		event_id: id,
		params: boundParams( params ),
		source_url: window.location.href,
		consent,
		...( matching && Object.keys( matching ).length ? { matching } : {} ),
	} );
	if ( body.length > 16000 ) {
		return false;
	}
	try {
		const beacon =
			services.beacon || navigator.sendBeacon?.bind( navigator );
		if ( beacon?.( config.event_url, body ) ) {
			return true;
		}
	} catch {
		/* A blocked beacon can use the same-origin fetch fallback. */
	}
	try {
		const fetch = services.fetch || window.fetch?.bind( window );
		fetch?.( config.event_url, {
			method: 'POST',
			credentials: 'same-origin',
			keepalive: true,
			headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
			body,
		} )?.catch( () => {} );
		return !! fetch;
	} catch {
		return false;
	}
}
