/**
 * Attach current consent to a form POST; only a confirmed WP hook creates a flag.
 * @param {Object} consent Live category reader.
 * @return {() => void} Cleanup.
 */
export function actionConsent( consent ) {
	const submit = ( event ) => {
		const form = event.target;
		if (
			! ( form instanceof window.HTMLFormElement ) ||
			form.method.toLowerCase() !== 'post'
		) {
			return;
		}
		try {
			if (
				new URL( form.action || window.location.href ).origin !==
				window.location.origin
			) {
				return;
			}
		} catch {
			return;
		}
		form.querySelectorAll(
			'input[name="pixelpair_action_consent"]'
		).forEach( ( input ) => input.remove() );
		const marketing = consent.read( 'marketing' );
		const statistics = consent.read( 'statistics' );
		if ( ! marketing.granted && ! statistics.granted ) {
			return;
		}
		const input = document.createElement( 'input' );
		input.type = 'hidden';
		input.name = 'pixelpair_action_consent';
		input.value = JSON.stringify( { marketing, statistics } );
		form.appendChild( input );
	};
	document.addEventListener( 'submit', submit, true );
	return () => document.removeEventListener( 'submit', submit, true );
}
