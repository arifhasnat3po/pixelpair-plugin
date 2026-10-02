import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const source = await fs.readFile(
	new URL( '../build/tracker.js', import.meta.url )
);
const bytes = gzipSync( source ).length;
if ( bytes >= 15 * 1024 ) {
	throw new Error(
		`Tracker exceeds the 15 KB gzip budget: ${ bytes } bytes.`
	);
}
process.stdout.write(
	`Tracker: ${ bytes } bytes gzip (limit: below 15360).\n`
);
