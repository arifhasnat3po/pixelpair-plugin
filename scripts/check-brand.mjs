import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const read = ( name ) => fs.readFileSync( path.join( root, name ) );
const names = [
	'pixelpair-mark',
	'pixelpair-mark-mono',
	'pixelpair-logo',
	'pixelpair-logo-mono',
];
for ( const name of names ) {
	const data = read( `brand/${ name }.svg` );
	assert.ok( data.length < 2048, name );
	assert.ok(
		! /<text|<image|@font-face|<script|<filter|<linearGradient|<radialGradient/.test(
			data.toString()
		),
		name
	);
}
assert.match(
	read( 'brand/pixelpair-mark-mono.svg' ).toString(),
	/currentColor/
);
assert.equal(
	read( 'brand/pixelpair-logo.svg' ).toString(),
	read( 'assets/images/pixelpair-logo.svg' ).toString()
);
assert.equal(
	read( 'brand/pixelpair-mark-mono.svg' ).toString(),
	read( 'assets/images/pixelpair-mark-mono.svg' ).toString()
);
for ( const [ name, width, height ] of [
	[ 'icon-128x128', 128, 128 ],
	[ 'icon-256x256', 256, 256 ],
	[ 'banner-772x250', 772, 250 ],
	[ 'banner-1544x500', 1544, 500 ],
] ) {
	const png = read( `.wordpress-org/${ name }.png` );
	assert.equal( png.subarray( 1, 4 ).toString(), 'PNG' );
	assert.equal( png.readUInt32BE( 16 ), width );
	assert.equal( png.readUInt32BE( 20 ), height );
}
const luminance = ( hex ) => {
	const channels = hex
		.match( /../g )
		.map( ( pair ) => parseInt( pair, 16 ) / 255 )
		.map( ( value ) =>
			value <= 0.04045
				? value / 12.92
				: ( ( value + 0.055 ) / 1.055 ) ** 2.4
		);
	return (
		channels[ 0 ] * 0.2126 + channels[ 1 ] * 0.7152 + channels[ 2 ] * 0.0722
	);
};
const accent = luminance( '9063b5' );
assert.ok( 1.05 / ( accent + 0.05 ) >= 3 );
assert.ok( ( accent + 0.05 ) / ( luminance( '1d2327' ) + 0.05 ) >= 3 );
const outputs = [
	...names.map( ( name ) => `brand/${ name }.svg` ),
	'brand/logo-preview.html',
	...fs
		.readdirSync( path.join( root, '.wordpress-org' ) )
		.map( ( name ) => `.wordpress-org/${ name }` ),
];
const digest = () =>
	createHash( 'sha256' )
		.update( Buffer.concat( outputs.map( read ) ) )
		.digest( 'hex' );
const before = digest();
execFileSync(
	process.execPath,
	[ path.join( root, 'scripts/build-brand.mjs' ) ],
	{ stdio: 'pipe' }
);
assert.equal( digest(), before, 'Brand output must be reproducible.' );
process.stdout.write(
	'PASS: SVG sizes/outlines, runtime copies, PNG dimensions, contrast and repeatable generation.\n'
);
