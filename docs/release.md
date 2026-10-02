# Building and installing a release

Use Node 24.21+, PHP and Composer. From the repository:

```sh
composer install
npm ci
npm run brand
npm run check:brand
npm run build
npm run check:front-size
npm run check:admin-size
npm run build:release
npm run test:release
```

Set `PIXELPAIR_PHP` to a PHP executable and `PIXELPAIR_COMPOSER` to a Composer PHAR when they are not on PATH. An optional first argument to `scripts/build-release.mjs` selects the output directory. Each build uses a fresh `.cache/release-*` staging directory, runs Composer without development dependencies there, checks assets/version metadata and emits a ZIP plus SHA-256 digest. Timestamps, ordering and Unix permissions are fixed, allowing identical builds from identical inputs. The main development vendor directory is never replaced. The illustrated guides and their screenshots remain in the repository; the ZIP includes a bundled offline guide and technical reference documents. The ZIP contains one top-level `pixelpair/` folder, production autoload files, compiled scripts and their readable source, translations and user documentation. Development tools/tests and credentials are excluded.

The builder emits `pixelpair.zip` and a versioned copy with matching SHA-256 digests. Brand sources, fonts and `.wordpress-org` assets are excluded; only the two small runtime SVGs ship.

Upload the built ZIP through Plugins → Add New → Upload Plugin. For an existing PixelPair installation choose **Replace current with uploaded**. Replacement preserves settings. When upgrading from the previous plugin identity, install and activate PixelPair as a new plugin: it migrates the previous settings and disables the previous entry. Do not delete either plugin before migration finishes. Open Installed Plugins afterwards and confirm the version, then open PixelPair → Overview. Complete setup, configure consent and test on a staging site. Purge page caches after changing settings or scripts.

If WordPress says **The link you followed has expired**, open a fresh upload page after signing in again and retry. If it repeats, check the host's `upload_max_filesize` and `post_max_size` against the ZIP size and review the PHP/web-server upload limits. You can also replace the `wp-content/plugins/pixelpair` folder using your host's file manager/SFTP after taking a backup. Never upload the source checkout ZIP as a release.

The built package contains `vendor/autoload.php`. The bootstrap can still load PixelPair's own classes if a host omits vendor, because the current plugin has no third-party PHP runtime dependencies. Missing compiled admin assets produce an explicit installation error. Neither Composer nor Node is required on the WordPress host.

The optional EDD 3.7.1 fixture needs PHP 8.0+ and WP 6.7+; WooCommerce 11.1.2 needs WP 7.0+; MCP Adapter 0.6.1 needs WP 6.9+. These extensions cannot be combined with every base-plugin compatibility floor. Unsupported combinations are reported explicitly. PHP 8.4 passed the local MariaDB and remote MySQL base suites. The old SQLite adapter is not a supported identity-migration database because it does not execute the required table renames.

Release checks run in the repository’s Quality workflow. Live Meta/TikTok event dashboards, Pixel Helper, GA4 DebugView, commercial subscription extensions and production cache/host configurations remain external acceptance checks. Automated interception tests do not prove vendor account acceptance. A built ZIP or local Plugin Check result is not WordPress.org approval; no directory submission occurs automatically.
