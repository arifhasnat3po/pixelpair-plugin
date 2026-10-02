const { defineConfig } = require( '@playwright/test' );

module.exports = defineConfig( {
	testDir: './tests/e2e',
	snapshotPathTemplate: '{testDir}/brand-snapshots/{arg}{ext}',
	testIgnore:
		process.env.PIXELPAIR_TEST_STORES === '1'
			? []
			: [
					'**/commerce.spec.js',
					'**/edd.spec.js',
					'**/ui-woocommerce.spec.js',
					'**/ui-edd.spec.js',
				],
	fullyParallel: false,
	workers: 1,
	retries: 0,
	use: {
		baseURL: process.env.PIXELPAIR_TEST_URL || 'http://localhost:8888',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: process.env.PIXELPAIR_CHROME
			? { executablePath: process.env.PIXELPAIR_CHROME }
			: {},
	},
} );
