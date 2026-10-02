import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const {
	PIXELPAIR_PHP: php,
	PIXELPAIR_WP_CLI: cli,
	PIXELPAIR_TEST_WP_ROOT: root,
} = process.env;
assert( php && cli && root, 'Set PHP, WP-CLI and disposable WordPress paths.' );
const key = 'woo:purchase:' + randomUUID();
const at = String( Date.now() / 1000 + 5 );
const fixture = fileURLToPath(
	new URL( '../tests/fixtures/claim.php', import.meta.url )
);
const run = () =>
	new Promise( ( resolve, reject ) => {
		const worker = spawn(
			php,
			[
				'-d',
				'memory_limit=512M',
				cli,
				'--path=' + root,
				'eval-file',
				fixture,
				key,
				at,
			],
			{ windowsHide: true }
		);
		let out = '';
		let error = '';
		worker.stdout.on( 'data', ( chunk ) => {
			out += chunk;
		} );
		worker.stderr.on( 'data', ( chunk ) => {
			error += chunk;
		} );
		worker.on( 'error', reject );
		worker.on( 'exit', ( code ) => {
			if ( code !== 0 ) {
				reject( new Error( error ) );
				return;
			}
			try {
				resolve( JSON.parse( out ) );
			} catch ( failure ) {
				reject( failure );
			}
		} );
	} );
const results = await Promise.all( [ run(), run() ] );
assert.equal( results[ 0 ].id, results[ 1 ].id );
assert.equal( results.filter( ( row ) => row.won ).length, 1 );
process.stdout.write(
	'Two concurrent PHP processes: one shared purchase UUID and one browser claim.\n'
);
