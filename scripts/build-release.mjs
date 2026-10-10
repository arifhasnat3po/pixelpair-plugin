import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';

const root = path.resolve(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const destination = path.resolve(
	process.argv[ 2 ] || path.join( root, 'releases' )
);
const php = process.env.PIXELPAIR_PHP || 'php';
const composer = process.env.PIXELPAIR_COMPOSER;
const version = JSON.parse(
	await fs.readFile( path.join( root, 'package.json' ), 'utf8' )
).version;
await fs.mkdir( path.join( root, '.cache' ), { recursive: true } );
const stage = await fs.mkdtemp( path.join( root, '.cache', 'release-' ) );
const plugin = path.join( stage, 'pixelpair' );
await fs.mkdir( plugin );
await fs.cp( path.join( root, 'src' ), path.join( plugin, 'src' ), {
	recursive: true,
} );
for ( const file of [ 'composer.json', 'composer.lock' ] ) {
	await fs.copyFile( path.join( root, file ), path.join( plugin, file ) );
}
const args = [
	'install',
	'--no-dev',
	'--prefer-dist',
	'--classmap-authoritative',
	'--no-interaction',
	'--no-scripts',
	'--no-plugins',
];
if ( composer ) {
	execFileSync( php, [ composer, ...args ], { cwd: plugin, stdio: 'pipe' } );
} else {
	execFileSync( 'composer', args, { cwd: plugin, stdio: 'pipe' } );
}
const installed = JSON.parse(
	await fs.readFile(
		path.join( plugin, 'vendor/composer/installed.json' ),
		'utf8'
	)
);
if ( installed.dev || installed.packages.length ) {
	throw new Error(
		'Expected no development or third-party runtime packages. Review the release allowlist when adding runtime dependencies.'
	);
}
// Runtime has no third-party PHP dependencies. Include only Composer runtime files.
for ( const file of [ 'composer.lock' ] ) {
	await fs.unlink( path.join( plugin, file ) );
}
for ( const name of [
	'pixelpair.php',
	'uninstall.php',
	'src',
	'build',
	'languages',
	'readme.txt',
	'LICENSE',
	'assets/src',
	'assets/images',
	'assets/docs',
] ) {
	await fs.cp( path.join( root, name ), path.join( plugin, name ), {
		recursive: true,
	} );
}
await fs.mkdir( path.join( plugin, 'docs' ) );
for ( const entry of [
	'capi.md',
	'commerce.md',
	'development.md',
	'events.md',
	'google-consent.md',
	'hooks.md',
	'mcp.md',
	'integrations.md',
	'release.md',
	'testing-meta.md',
] ) {
	if ( entry.endsWith( '.md' ) ) {
		await fs.copyFile(
			path.join( root, 'docs', entry ),
			path.join( plugin, 'docs', entry )
		);
	}
}
for ( const name of [
	'build/admin.js',
	'build/admin.asset.php',
	'build/style-admin.css',
	'build/tracker.js',
	'build/tracker.asset.php',
	'languages/pixelpair.pot',
	'vendor/autoload.php',
] ) {
	await fs.access( path.join( plugin, name ) );
}
const header = await fs.readFile(
	path.join( plugin, 'pixelpair.php' ),
	'utf8'
);
const readme = await fs.readFile( path.join( plugin, 'readme.txt' ), 'utf8' );
if (
	! header.includes( `Version: ${ version }` ) ||
	! readme.includes( `Stable tag: ${ version }` )
) {
	throw new Error( 'Release version metadata is inconsistent.' );
}
const zip = new AdmZip();
const stamp = new Date( '1980-01-01T00:00:00.000Z' );
async function add( directory, relative = 'pixelpair' ) {
	const folder = zip.addFile( relative + '/', Buffer.alloc( 0 ) );
	folder.header.time = stamp;
	folder.header.timeval = 0x00210000;
	folder.header.made = 0x0314;
	folder.attr = 0o40755 * 65536 + 0x10;
	const entries = (
		await fs.readdir( directory, { withFileTypes: true } )
	).sort( ( a, b ) => ( a.name < b.name ? -1 : 1 ) );
	for ( const entry of entries ) {
		const full = path.join( directory, entry.name ),
			name = relative + '/' + entry.name;
		if ( entry.isSymbolicLink() ) {
			throw new Error( 'Symlinks cannot be packaged.' );
		}
		if ( entry.isDirectory() ) {
			await add( full, name );
		} else {
			if (
				/\.(?:map|zip)$/.test( name ) ||
				entry.name.startsWith( '.' )
			) {
				await fs.unlink( full );
				continue;
			}
			const item = zip.addFile( name, await fs.readFile( full ) );
			item.header.time = stamp;
			item.header.timeval = 0x00210000;
			item.header.made = 0x0314;
			item.attr = 0o100644 * 65536;
		}
	}
}
await add( plugin );
await fs.mkdir( destination, { recursive: true } );
const output = path.join( destination, `pixelpair-${ version }.zip` );
const bytes = zip.toBuffer();
await fs.writeFile( output, bytes );
const digest = createHash( 'sha256' ).update( bytes ).digest( 'hex' );
await fs.writeFile( path.join( destination, 'pixelpair.zip' ), bytes );
await fs.writeFile(
	path.join( destination, 'pixelpair.zip.sha256' ),
	digest + '  pixelpair.zip\n'
);
await fs.writeFile(
	output + '.sha256',
	digest + '  ' + path.basename( output ) + '\n'
);
await fs.writeFile(
	path.join( stage, 'manifest.json' ),
	JSON.stringify(
		{
			version,
			plugin,
			output,
			sha256: digest,
			entries: zip.getEntries().length,
		},
		null,
		2
	) + '\n'
);
process.stdout.write(
	JSON.stringify( {
		version,
		plugin,
		output,
		sha256: digest,
		bytes: bytes.length,
	} ) + '\n'
);
