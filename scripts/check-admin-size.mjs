import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const bytes = gzipSync( readFileSync( 'build/admin.js' ) ).length;
if ( bytes >= 150 * 1024 ) {
	throw new Error(
		`Initial admin JavaScript is ${ bytes } bytes gzip; limit is under 150 KB.`
	);
}
process.stdout.write(
	`PASS: initial admin JavaScript ${ bytes } bytes gzip; WordPress packages are external.\n`
);
