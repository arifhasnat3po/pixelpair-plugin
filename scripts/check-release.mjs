import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
const zip = new AdmZip(
	path.resolve(
		process.argv[ 2 ] ||
			`releases/pixelpair-${ JSON.parse( fs.readFileSync( 'package.json' ) ).version }.zip`
	)
);
const entries = zip.getEntries();
for ( const entry of entries ) {
	assert.ok( entry.entryName.startsWith( 'pixelpair/' ) );
	assert.ok(
		! /(?:^|\/)(?:brand|\.wordpress-org|fonts|node_modules|tests|\.git|\.cache|\.env|PROMPT.md|PLAN.md|phpunit|phpstan)(?:\/|$)/.test(
			entry.entryName
		),
		entry.entryName
	);
	assert.equal(
		Math.floor( entry.attr / 65536 ) % 512,
		entry.isDirectory ? 0o755 : 0o644,
		entry.entryName
	);
	assert.equal( entry.header.timeval, 0x00210000 );
}
for ( const name of [
	'pixelpair.php',
	'build/admin.js',
	'build/tracker.js',
	'build/scripts.js',
	'languages/pixelpair.pot',
	'assets/images/pixelpair-logo.svg',
	'assets/images/pixelpair-mark-mono.svg',
	'assets/docs/admin-guide.html',
	'vendor/autoload.php',
] ) {
	assert.ok( zip.getEntry( 'pixelpair/' + name ), name );
}
const installed = JSON.parse(
	zip.readAsText( 'pixelpair/vendor/composer/installed.json' )
);
assert.ok(
	zip
		.readAsText( 'pixelpair/vendor/composer/autoload_classmap.php' )
		.includes( 'PixelPair\\\\Plugin' ),
	'Optimized autoload must contain the plugin classes.'
);
assert.equal( installed.dev, false );
assert.equal( installed.packages.length, 0 );
assert.ok( ! zip.getEntry( 'pixelpair/vendor/phpunit/' ) );
assert.ok(
	zip
		.readAsText( 'pixelpair/pixelpair.php' )
		.includes( 'spl_autoload_register' )
);
process.stdout.write(
	`PASS: ${ entries.length } entries; installable assets, production autoload, modes and deterministic timestamps verified.`
);
