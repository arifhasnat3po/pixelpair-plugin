# Contributing to PixelPair

Use [Issues](https://github.com/arifhasnat3po/pixelpair-plugin/issues) for reproducible bugs and feature proposals. For vulnerabilities, use the private channel in [SECURITY.md](SECURITY.md). Never attach live tokens, customer data or unreviewed settings exports.

## Set up

Clone into the canonical plugin folder:

```sh
git clone https://github.com/arifhasnat3po/pixelpair-plugin.git pixelpair
cd pixelpair
composer install
npm ci
npm run build
npx wp-env start
```

Use Composer 2, Node 24.21+, npm 11.16+ and Docker. The test fixtures create and remove data: use disposable local sites only. Detailed setup, fixture accounts and environment variables are in [development](docs/development.md).

## Make a change

Keep changes focused, use WordPress coding conventions and translate user-facing strings. Reuse the shared admin components and design tokens. Tracking, settings and REST changes need explicit behavioral tests; never expose a credential in API responses, logs, screenshots or snapshots.

Run the relevant checks before opening a pull request:

```sh
composer lint
composer analyse
composer test
npm run lint:js
npm run lint:css
npm run format:check
npm run test:unit -- --runInBand
npm run build
npm run check:front-size
npm run check:admin-size
```

For UI changes, run the applicable Playwright tests and include screenshots at desktop and narrow widths. Keep keyboard access, reduced-motion behavior, RTL and admin color schemes working. The Quality workflow runs the full base compatibility, browser, commerce and release checks.

## Submit

Explain the problem, the resulting behavior and how you tested it. Update the relevant illustrated guide when controls or workflows change. Do not commit generated dependencies, built bundles, release ZIPs, local environment files, credentials or personal development notes. Release assets are attached to GitHub Releases; [release.md](docs/release.md) describes the reproducible build.

Contributions are distributed under the repository's [GPL-2.0-or-later license](LICENSE).
