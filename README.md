<p align="left"><img src="brand/pixelpair-logo.svg" width="240" alt="PixelPair" /></p>

# Arif PixelPair – Marketing Tracking

Independent marketing tracking integrations for WordPress.

Arif PixelPair is independently developed by Arif Hasnat. It integrates with Meta, Google Analytics, Google Tag Manager, TikTok, WooCommerce and Easy Digital Downloads. It is not affiliated with or endorsed by those services or their owners.

Connect your advertising and analytics accounts, choose the events to track, and inspect server delivery from WordPress. PixelPair includes a skippable setup wizard, consent controls, a custom event builder, and WooCommerce and Easy Digital Downloads support.

[![Quality](https://github.com/arifhasnat3po/pixelpair-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/arifhasnat3po/pixelpair-plugin/actions/workflows/ci.yml)
[![License: GPL v2 or later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue.svg)](LICENSE)

[Download the installable plugin](https://github.com/arifhasnat3po/pixelpair-plugin/releases/latest/download/pixelpair.zip) · [Illustrated documentation](docs/README.md) · [Release notes](CHANGELOG.md)

![PixelPair Overview with connection status and setup actions](docs/images/overview.png)

_Screenshots use a disposable demonstration site. Example IDs, errors and check results are illustrative, not evidence of delivery to a live advertising account._

## Install and connect Meta

1. Download **pixelpair.zip** from [Releases](https://github.com/arifhasnat3po/pixelpair-plugin/releases/latest). In WordPress, open **Plugins → Add New → Upload Plugin**, upload the ZIP and activate PixelPair.
2. Open **PixelPair**. Choose **Facebook and Instagram ads** in setup, then paste your Meta Pixel ID or full base-code snippet. PixelPair extracts the ID for you.
3. Select **Save and continue**, then **Check connection**. Server delivery is optional and requires your own access token; a real server test also requires a test event code.
4. Finish setup, review your consent settings, and open your site to verify browser events using Meta Pixel Helper and Events Manager.

Use the built **pixelpair.zip** release asset. GitHub's **Source code (zip)** is a developer checkout without compiled assets. Node and Composer are not required on your WordPress host.

[Follow the screenshot walkthrough](docs/guides/getting-started.md).

## What is included

| Area           | Features                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Connections    | Meta Pixel + Conversions API, Google Analytics, Google Tag Manager, TikTok Pixel + Events API   |
| Events         | Automatic events, sentence-style custom rules, per-platform mappings and payload previews       |
| Stores         | WooCommerce classic and Blocks flows, HPOS, EDD, product/cart/checkout and paid-purchase events |
| Privacy        | Consent integrations, role/IP/bot exclusions, fast and strict cache modes                       |
| Diagnostics    | Connection checks, bounded server retries, optional redacted delivery logs                      |
| Administration | Secret-free configuration import/export, per-site multisite settings                            |
| AI access      | Optional authenticated MCP tools for inspecting configuration and managing settings/events      |

Tracking starts disabled. With no detected consent tool, marketing is allowed by default once you enable a connection. A detected tool must resolve the visitor's decision before tracking starts. Enable **Wait for marketing consent** in Privacy when you require an explicit decision. See [privacy and settings](docs/guides/privacy-and-settings.md).

PixelPair uses shared browser/server event IDs. Its server log does not establish that a browser event arrived or that a platform deduplicated it; verify those in the platform's own tools. No PixelPair telemetry, advertising, or model subscription is included.

## Requirements

| Component           | Requirement                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| Base plugin         | WordPress 6.2+, PHP 7.4+, MySQL/MariaDB                                         |
| Tested base matrix  | WordPress 6.2, 7.0.6 and 7.1.2 across supported PHP 7.4–8.4 pairings            |
| WooCommerce fixture | WooCommerce 11.1.2, WordPress 7.1.2, PHP 8.3                                    |
| EDD fixture         | EDD 3.7.1; requires WordPress 6.7+ and PHP 8.0+                                 |
| AI access           | WordPress 6.9+, official WordPress MCP Adapter, HTTPS and an authorized account |

Optional extensions have their own requirements. See [compatibility and delivery limits](docs/commerce.md) and the [Quality workflow](.github/workflows/ci.yml). Live platform dashboards, commercial subscription extensions and your production cache/host still need site-specific verification. This release has not been approved for the WordPress.org plugin directory.

## Documentation

- [Getting started](docs/guides/getting-started.md) — install, connect Meta, and verify a visitor event.
- [Connections](docs/guides/connections.md) — Meta, Google Analytics, Tag Manager and TikTok.
- [Events](docs/guides/events.md) — automatic tracking and a button-click example.
- [Store tracking](docs/guides/stores.md) — WooCommerce and EDD settings.
- [Privacy and settings](docs/guides/privacy-and-settings.md) — consent, exclusions, caching and backups.
- [Activity](docs/guides/activity.md) — inspect redacted server delivery attempts.
- [AI access](docs/guides/ai-access.md) — connect an authenticated external MCP client.
- [Troubleshooting](docs/guides/troubleshooting.md) — installation, missing events and connection errors.
- [Screenshot gallery](docs/screenshots.md) — all current screens, including the narrower layout.

## Develop from source

Clone into a folder named `pixelpair` so WordPress and the test fixtures use the canonical plugin path:

```sh
git clone https://github.com/arifhasnat3po/pixelpair-plugin.git pixelpair
cd pixelpair
composer install
npm ci
npm run build
npx wp-env start
```

Use Composer 2, Node 24.21+, npm 11.16+ and Docker for wp-env. Run tests only on disposable sites. See [development](docs/development.md), [contributing](CONTRIBUTING.md) and [release packaging](docs/release.md).

## Support, security and license

Report reproducible bugs through [GitHub Issues](https://github.com/arifhasnat3po/pixelpair-plugin/issues). Follow [SECURITY.md](SECURITY.md) for vulnerabilities; never post access tokens or customer data in an issue.

Built by [Arif Hasnat](https://github.com/arifhasnat3po). Licensed under [GPL-2.0-or-later](LICENSE). The repository's brand font has its own [OFL license](brand/fonts/OFL.txt); it is not shipped in the plugin or loaded in WordPress administration.
