import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const target = path.resolve(
	root,
	process.argv[ 2 ] || '.cache/artifact/pixelpair'
);
if ( ! target.startsWith( root + path.sep ) ) {
	throw new Error( 'Artifact staging must stay inside the repository.' );
}
await fs.mkdir( target, { recursive: true } );
if ( ( await fs.readdir( target ) ).length ) {
	throw new Error( 'Artifact staging requires an empty destination.' );
}
const installed = JSON.parse(
	await fs.readFile( 'vendor/composer/installed.json', 'utf8' )
);
if ( installed.dev ) {
	throw new Error(
		'Stage only after composer install --no-dev in a disposable build checkout.'
	);
}
for ( const name of [
	'pixelpair.php',
	'uninstall.php',
	'src',
	'build',
	'vendor',
	'languages',
	'readme.txt',
	'LICENSE',
	'assets/images',
] ) {
	await fs.cp( path.join( root, name ), path.join( target, name ), {
		recursive: true,
	} );
}
for ( const name of [
	'build/admin.js',
	'build/admin.asset.php',
	'build/style-admin.css',
	'build/tracker.js',
	'build/tracker.asset.php',
	'vendor/autoload.php',
] ) {
	await fs.access( path.join( target, name ) );
}
process.stdout.write( `Installable plugin staged at ${ target }\n` );
