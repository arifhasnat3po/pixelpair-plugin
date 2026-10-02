// Mirror the existing server's field boundaries for immediate, local feedback.
export function validServerUrl( value ) {
	if ( ! value ) {
		return true;
	}
	try {
		const url = new URL( value );
		return (
			value.length <= 2048 &&
			url.protocol === 'https:' &&
			!! url.hostname &&
			! url.username &&
			! url.password &&
			! url.search &&
			! url.hash
		);
	} catch {
		return false;
	}
}
export function validDataLayer( value ) {
	return (
		/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test( value || '' ) &&
		! [
			'__proto__',
			'prototype',
			'constructor',
			'window',
			'document',
			'location',
			'navigator',
			'history',
			'top',
			'self',
			'parent',
			'frames',
			'name',
			'onload',
			'fbq',
			'gtag',
			'pixelpairConfig',
			'pixelpairRuntime',
		].includes( value )
	);
}
