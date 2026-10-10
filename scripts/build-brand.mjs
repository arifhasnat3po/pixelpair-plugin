import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import { optimize } from 'svgo';

const root = path.resolve(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const accent = '#9063b5';
const ink = '#1d2327';
const read = ( name ) => fs.readFile( path.join( root, name ), 'utf8' );
const write = ( name, value ) => fs.writeFile( path.join( root, name ), value );
for ( const folder of [ 'brand', '.wordpress-org', 'assets/images' ] ) {
	await fs.mkdir( path.join( root, folder ), { recursive: true } );
}
const fontBytes = await fs.readFile(
	path.join( root, 'brand/fonts/Outfit.ttf' )
);
const font = opentype.parse(
	fontBytes.buffer.slice(
		fontBytes.byteOffset,
		fontBytes.byteOffset + fontBytes.byteLength
	)
);
font.variation.set( { wght: 500 } );
// Latin-only brand strings use individual glyphs and kerning, with no shaping substitutions.
const textPath = ( text, x, y, size ) => {
	const outline = new opentype.Path();
	let previous;
	for ( const character of text ) {
		const glyph = font.charToGlyph( character );
		if ( previous ) {
			x +=
				( font.getKerningValue( previous, glyph ) * size ) /
				font.unitsPerEm;
		}
		outline.extend(
			glyph.getPath( x, y, size, font.defaultRenderOptions, font )
		);
		x += ( glyph.advanceWidth * size ) / font.unitsPerEm;
		previous = glyph;
	}
	return outline;
};
const outlined = ( text, x, y, size ) => {
	const outline = textPath( text, x, y, size );
	return `<path fill="${ ink }" d="${ outline.toPathData( { decimalPlaces: 1, flipY: false } ) }"/>`;
};
const svg = ( width, height, body ) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ width } ${ height }">${ body }</svg>`;
const compact = ( value ) =>
	optimize( value, { multipass: true, floatPrecision: 1 } ).data;
const inside = ( value ) =>
	value.replace( /^.*?<svg[^>]*>/s, '' ).replace( /<\/svg>\s*$/, '' );
const source = await read( 'brand/mark-source.svg' );
const mark = compact( source.replaceAll( 'currentColor', accent ) );
const mono = compact( source );
const markBody = `<g fill="${ accent }">${ inside( mark ) }</g>`;
const logoWidth = Math.ceil(
	32 + textPath( 'PixelPair', 0, 0, 18 ).getBoundingBox().x2
);
const logo = compact(
	svg( logoWidth, 24, markBody + outlined( 'PixelPair', 30, 18, 18 ) )
);
const logoMono = logo
	.replaceAll( accent, 'currentColor' )
	.replaceAll( ink, 'currentColor' );
for ( const [ name, value ] of Object.entries( {
	'pixelpair-mark.svg': mark,
	'pixelpair-mark-mono.svg': mono,
	'pixelpair-logo.svg': logo,
	'pixelpair-logo-mono.svg': logoMono,
} ) ) {
	if ( Buffer.byteLength( value ) >= 2048 ) {
		throw new Error(
			`${ name } exceeds the 2 KB SVG limit (${ Buffer.byteLength( value ) }).`
		);
	}
	await write( `brand/${ name }`, value );
	process.stdout.write(
		`${ name }: ${ Buffer.byteLength( value ) } bytes\n`
	);
}
await write( 'assets/images/pixelpair-mark-mono.svg', mono );
await write( 'assets/images/pixelpair-logo.svg', logo );
const icon = compact(
	svg( 24, 24, `<rect width="24" height="24" fill="#fff"/>${ markBody }` )
);
await write( '.wordpress-org/icon.svg', icon );
const png = ( input, width ) =>
	new Resvg( input, {
		fitTo: { mode: 'width', value: width },
		font: { loadSystemFonts: false },
	} )
		.render()
		.asPng();
for ( const size of [ 128, 256 ] ) {
	await write(
		`.wordpress-org/icon-${ size }x${ size }.png`,
		png( icon, size )
	);
}
const banner = svg(
	772,
	250,
	`<rect width="772" height="250" fill="#f6f7f7"/><g transform="translate(48 40) scale(2)">${ inside( logo ) }</g>${ outlined( 'PixelPair', 48, 155, 25 ) }${ outlined( 'Marketing Tracking', 48, 190, 25 ) }`
);
await write( '.wordpress-org/banner-772x250.png', png( banner, 772 ) );
await write( '.wordpress-org/banner-1544x500.png', png( banner, 1544 ) );
const variants = [
	[ 'a', 'A · Joined pair (default)' ],
	[ 'b', 'B · Overlapping pair' ],
	[ 'c', 'C · Filled and outlined' ],
];
const previews = [];
for ( const [ key, title ] of variants ) {
	const variant = await read( `brand/variants/${ key }.svg` );
	const rows = [
		[ '#fff', 'White' ],
		[ '#f0f0f1', 'Light gray' ],
		[ '#1d2327', 'Admin menu' ],
	]
		.map(
			( [ background, label ] ) =>
				`<div class="sample" style="background:${ background };color:${ background === ink ? '#fff' : ink }"><span>${ label }</span>${ [ 16, 20, 32, 64, 256 ].map( ( size ) => `<figure><div style="color:${ accent };width:${ size }px;height:${ size }px">${ variant }</div><figcaption>${ size } px</figcaption></figure>` ).join( '' ) }</div>`
		)
		.join( '' );
	previews.push( `<section><h2>${ title }</h2>${ rows }</section>` );
}
await write(
	'brand/logo-preview.html',
	`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PixelPair logo variants</title><style>body{font:14px/1.5 system-ui,sans-serif;color:${ ink };margin:32px;max-width:1100px}h1{font-size:28px}h2{font-size:20px;margin-top:32px}.sample{display:flex;align-items:center;gap:24px;padding:24px;border:1px solid #c3c4c7;flex-wrap:wrap}.sample>span{width:90px}figure{margin:0;text-align:center}figcaption{font-size:12px;margin-top:8px}svg{width:100%;height:100%}.wordmark{width:240px;margin-block:24px}</style><h1>PixelPair</h1><p>Two events, matched into one. Variant A is the default. Accent contrast: 4.53:1 on white, 3.51:1 on the dark admin menu.</p><img class="wordmark" src="pixelpair-logo.svg" alt="PixelPair">${ previews.join( '' ) }<p>Swap mark-source.svg with one of the variants and run npm run brand to regenerate every output.</p></html>`
);
