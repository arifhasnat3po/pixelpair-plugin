import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { JSDOM } from 'jsdom';

const root = path.resolve(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const source = path.join( root, 'docs' );
const output = path.join( root, '.cache', 'docs-site' );
const base = 'https://arifhasnat3po.github.io/pixelpair-plugin/';
const repository = 'https://github.com/arifhasnat3po/pixelpair-plugin';
const markdown = new MarkdownIt( { html: true } );
const pages = new Map();
const toPage = ( file ) =>
	file === 'README.md' ? 'index.html' : file.replace( /\.md$/, '.html' );

async function collect( directory, relative = '' ) {
	for ( const entry of await fs.readdir( directory, {
		withFileTypes: true,
	} ) ) {
		if ( entry.isSymbolicLink() ) {
			throw new Error( 'Documentation must not contain symlinks.' );
		}
		const name = path.posix.join( relative, entry.name );
		if ( entry.isDirectory() ) {
			await collect( path.join( directory, entry.name ), name );
		} else if ( entry.name.endsWith( '.md' ) ) {
			pages.set(
				name,
				await fs.readFile( path.join( directory, entry.name ), 'utf8' )
			);
		}
	}
}
await collect( source );
// Only this generated directory is cleared; source documents are never modified.
await fs.rm( output, { recursive: true, force: true } );
await fs.mkdir( output, { recursive: true } );
await fs.cp( path.join( source, 'images' ), path.join( output, 'images' ), {
	recursive: true,
} );
await fs.copyFile(
	path.join( source, 'site.css' ),
	path.join( output, 'site.css' )
);
await fs.mkdir( path.join( output, 'brand' ) );
await fs.copyFile(
	path.join( root, '.wordpress-org', 'banner-772x250.png' ),
	path.join( output, 'brand', 'banner.png' )
);

const documents = new Map();
for ( const [ file, text ] of pages ) {
	const destination = toPage( file );
	const prefix = '../'.repeat( destination.split( '/' ).length - 1 );
	const dom = new JSDOM(
		`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title><link rel="stylesheet" href="${ prefix }site.css"></head><body><a class="skip-link" href="#content">Skip to content</a><header><a href="${ prefix }index.html">PixelPair documentation</a><nav aria-label="Documentation"><a href="${ prefix }guides/getting-started.html">Getting started</a><a href="${ prefix }screenshots.html">Screenshots</a><a href="${ repository }">Source code</a></nav></header><main id="content">${ markdown.render( text ) }</main><footer>PixelPair is independently developed by Arif Hasnat. <a href="${ repository }/issues">Report a documentation issue</a>.</footer></body></html>`
	);
	const document = dom.window.document;
	document.title =
		document.querySelector( 'h1' )?.textContent ||
		'PixelPair documentation';
	const headings = new Set( [ 'content' ] );
	for ( const heading of document.querySelectorAll( 'h1, h2, h3, h4' ) ) {
		const slug = heading.textContent
			.toLowerCase()
			.replace( /[^\p{L}\p{N}\s-]/gu, '' )
			.trim()
			.replace( /\s+/g, '-' );
		let id = slug;
		let suffix = 1;
		while ( headings.has( id ) ) {
			id = `${ slug }-${ suffix++ }`;
		}
		heading.id = id;
		headings.add( id );
	}
	for ( const element of document.querySelectorAll(
		'main a[href], main img[src]'
	) ) {
		const attr = element.tagName === 'IMG' ? 'src' : 'href';
		const value = element.getAttribute( attr );
		if ( /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test( value ) ) {
			continue;
		}
		const resolved = new URL(
			value,
			`https://source.invalid/docs/${ file }`
		);
		const relative = decodeURIComponent( resolved.pathname ).slice( 1 );
		if ( relative.startsWith( 'docs/' ) ) {
			const local = relative.slice( 5 );
			if ( local.endsWith( '.md' ) && ! pages.has( local ) ) {
				throw new Error( `${ file }: missing document ${ value }` );
			}
			element.setAttribute(
				attr,
				prefix + toPage( local ) + resolved.search + resolved.hash
			);
		} else if ( relative === '.wordpress-org/banner-772x250.png' ) {
			element.setAttribute( attr, prefix + 'brand/banner.png' );
		} else {
			await fs.access( path.join( root, relative ) );
			const kind = (
				await fs.stat( path.join( root, relative ) )
			).isDirectory()
				? 'tree'
				: 'blob';
			element.setAttribute(
				attr,
				`${ repository }/${ kind }/main/${ relative }${ resolved.hash }`
			);
		}
	}
	for ( const img of document.querySelectorAll( 'img' ) ) {
		img.setAttribute( 'loading', 'lazy' );
	}
	for ( const sample of document.querySelectorAll( 'pre' ) ) {
		sample.tabIndex = 0;
		sample.setAttribute( 'role', 'region' );
		sample.setAttribute( 'aria-label', 'Code sample' );
	}
	for ( const table of document.querySelectorAll( 'table' ) ) {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'table-scroll';
		wrapper.tabIndex = 0;
		wrapper.setAttribute( 'role', 'region' );
		wrapper.setAttribute( 'aria-label', 'Reference table' );
		table.replaceWith( wrapper );
		wrapper.append( table );
	}
	documents.set( destination, document );
	await fs.mkdir( path.dirname( path.join( output, destination ) ), {
		recursive: true,
	} );
	await fs.writeFile( path.join( output, destination ), dom.serialize() );
}

let checked = 0;
for ( const [ file, document ] of documents ) {
	for ( const element of document.querySelectorAll( '[href], [src]' ) ) {
		const value =
			element.getAttribute( 'href' ) || element.getAttribute( 'src' );
		const url = new URL( value, base + file );
		if ( ! url.href.startsWith( base ) ) {
			continue;
		}
		const local = decodeURIComponent(
			url.pathname.slice( new URL( base ).pathname.length )
		);
		await fs.access( path.join( output, local ) );
		if (
			url.hash &&
			! documents
				.get( local )
				?.getElementById( decodeURIComponent( url.hash.slice( 1 ) ) )
		) {
			throw new Error( `${ file }: missing anchor ${ value }` );
		}
		checked++;
	}
}
await fs.writeFile( path.join( output, '.nojekyll' ), '' );
process.stdout.write(
	`PASS: built ${ pages.size } documentation pages; ${ checked } internal links, anchors and assets verified.\n`
);
