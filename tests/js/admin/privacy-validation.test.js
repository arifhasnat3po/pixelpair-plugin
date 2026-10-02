import { validIpRange } from '../../../assets/src/admin/data/privacy';
test.each( [
	'127.0.0.1',
	'0.0.0.0/0',
	'192.0.2.0/24',
	'::1',
	'2001:db8::/32',
	'::ffff:192.0.2.1',
	'2001:db8:0:1:2:3:4:5/128',
] )( 'accepts IP range %s', ( value ) =>
	expect( validIpRange( value ) ).toBe( true )
);
test.each( [
	'',
	'localhost',
	'999.1.2.3',
	'192.168.001.1',
	'1.2.3.4/33',
	'::/129',
	':::/12',
	'::1/-1',
	'::1/2/3',
	'user@::1',
	'1.2.3.4/',
	'fe80::1%eth0',
	'::1/1.5',
] )( 'rejects IP range %s', ( value ) =>
	expect( validIpRange( value ) ).toBe( false )
);
