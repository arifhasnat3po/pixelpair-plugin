import { startScripts } from './scripts';
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', () => startScripts(), {
		once: true,
	} );
} else {
	startScripts();
}
