const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'node:path' );

module.exports = {
	...defaultConfig,
	entry: {
		admin: path.resolve( __dirname, 'assets/src/admin/index.js' ),
		tracker: path.resolve( __dirname, 'assets/src/front/index.js' ),
	},
};
