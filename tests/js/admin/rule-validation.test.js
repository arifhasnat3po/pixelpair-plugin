import {
	validSelector,
	validRegex,
	triggerError,
	conditionError,
} from '../../../assets/src/admin/data/rules';
test.each( [
	'.book-call-btn',
	'main > button.submit',
	'a#offer, .signup',
	'* > div',
] )( 'accepts supported selector %s', ( value ) =>
	expect( validSelector( value ) ).toBe( true )
);
test.each( [
	'button:has(script)',
	'[onclick]',
	'.a >> button',
	'a,',
	'',
	'a'.repeat( 257 ),
] )( 'rejects unsupported selector %s', ( value ) =>
	expect( validSelector( value ) ).toBe( false )
);
test.each( [ '^/pricing.*', 'offer\\?coupon=save', '^/abc$' ] )(
	'accepts bounded regex %s',
	( value ) => expect( validRegex( value ) ).toBe( true )
);
test.each( [ '(a+)+', '.*foo.*', '[a-z]', 'offer\\d', 'a{2}', '' ] )(
	'rejects unsupported regex %s',
	( value ) => expect( validRegex( value ) ).toBe( false )
);
test( 'existing advanced triggers retain their bounded contract', () => {
	[
		{ type: 'home', delay: 12 },
		{ type: 'post_type', value: 'product' },
		{ type: 'posts', value: '12,34' },
		{ type: 'terms', value: 'category:12' },
		{ type: 'url_param', key: 'coupon', operator: 'present', value: '' },
		{ type: 'time', value: 3600 },
		{ type: 'page_count', value: 2 },
		{ type: 'visible', value: '.offer' },
	].forEach( ( row ) => expect( triggerError( row ) ).toBe( '' ) );
	[
		{ type: 'scroll', value: 101 },
		{ type: 'home', delay: -1 },
		{ type: 'posts', value: '12, 34' },
		{ type: 'terms', value: '12' },
		{ type: 'url_param', key: 'bad key', operator: 'present', value: '' },
	].forEach( ( row ) => expect( triggerError( row ) ).not.toBe( '' ) );
	expect(
		conditionError( {
			type: 'referrer_domain',
			value: 'https://example.test/path',
		} )
	).not.toBe( '' );
	expect( conditionError( { type: 'role', value: 'logged-out' } ) ).toBe(
		''
	);
} );
