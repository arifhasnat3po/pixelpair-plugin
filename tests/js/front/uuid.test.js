import { uuid } from '../../../assets/src/front/uuid';

test( 'secure UUIDs are distinct and have v4 version and variant bits', () => {
	const values = new Set(
		Array.from( { length: 200 }, () => uuid( window.crypto ) )
	);
	expect( values.size ).toBe( 200 );
	for ( const value of values ) {
		expect( value ).toMatch(
			/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
		);
	}
} );

test( 'getRandomValues fallback preserves entropy; no insecure fallback', () => {
	const source = {
		getRandomValues: ( bytes ) => window.crypto.getRandomValues( bytes ),
	};
	expect( uuid( source ) ).toMatch(
		/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
	);
	expect( uuid( {} ) ).toBeNull();
} );
