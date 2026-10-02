const wpPlugin = require( '@wordpress/eslint-plugin' );
const jestPlugin = require( 'eslint-plugin-jest' );

module.exports = [
	{
		ignores: [
			'**/build/**',
			'**/node_modules/**',
			'**/vendor/**',
			'.cache/**',
		],
	},
	...wpPlugin.configs.recommended,
	{
		rules: {
			'jsdoc/check-tag-names': [
				'error',
				{ definedTags: [ 'jsxRuntime' ] },
			],
		},
	},
	{
		languageOptions: {
			parserOptions: {
				requireConfigFile: false,
				babelOptions: {
					presets: [
						require.resolve( '@wordpress/babel-preset-default' ),
					],
				},
			},
		},
	},
	{
		...jestPlugin.configs[ 'flat/recommended' ],
		files: [ 'tests/js/**/*.js' ],
	},
	...wpPlugin.configs[ 'test-playwright' ].map( ( config ) => ( {
		...config,
		files: [ 'tests/e2e/**/*.js' ],
	} ) ),
];
