import fs from 'node:fs/promises';

// VERIFY: update latest/previous pins after checking the WordPress release API.
const wp = process.env.MATRIX_WP;
const php = process.env.MATRIX_PHP;
const response = await fetch(
	'https://api.wordpress.org/core/version-check/1.7/'
);
if ( ! response.ok ) {
	throw new Error( `Cannot verify compatibility: HTTP ${ response.status }` );
}
const { offers } = await response.json();
const offer = offers.find( ( entry ) => entry.version === wp );
// The explicitly supported historical floor does not always appear in offers.
const minimum = wp === '6.2' ? '5.6.20' : offer?.php_version;
if ( ! minimum ) {
	throw new Error(
		`Unsupported or unverified pairing: WP ${ wp } / PHP ${ php }; no release metadata. Update the matrix explicitly.`
	);
}
const numbers = ( version ) => version.split( '.' ).map( Number );
const a = numbers( php ),
	b = numbers( minimum );
if ( a[ 0 ] < b[ 0 ] || ( a[ 0 ] === b[ 0 ] && a[ 1 ] < b[ 1 ] ) ) {
	throw new Error(
		`Unsupported pairing: WordPress ${ wp } requires PHP ${ minimum }; requested ${ php }.`
	);
}
if (
	process.env.MATRIX_COMMERCE === 'true' &&
	Number( wp.split( '.' )[ 0 ] ) < 7
) {
	throw new Error(
		'Unsupported pairing: WooCommerce 11.1.2 requires WordPress 7.0 or later.'
	);
}
await fs.writeFile(
	'.wp-env.override.json',
	JSON.stringify(
		{
			core: `https://downloads.wordpress.org/release/wordpress-${ wp }.zip`,
			phpVersion: php,
			multisite: process.env.MATRIX_MULTISITE === 'true',
			...( process.env.MATRIX_COMMERCE === 'true'
				? {
						plugins: [
							'.',
							'https://downloads.wordpress.org/plugin/woocommerce.11.1.2.zip',
							'https://downloads.wordpress.org/plugin/easy-digital-downloads.3.7.1.zip',
							'https://github.com/WordPress/mcp-adapter/releases/download/v0.6.1/mcp-adapter.zip',
						],
						config: { WP_ENVIRONMENT_TYPE: 'local' },
					}
				: {} ),
		},
		null,
		2
	)
);
process.stdout.write(
	`Requested WP ${ wp } / PHP ${ php }; published PHP minimum ${ minimum }. Runtime tests must still pass.\n`
);
