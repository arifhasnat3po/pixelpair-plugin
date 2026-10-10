=== Arif PixelPair – Marketing Tracking ===
Contributors: arifhasnat
Tags: analytics, meta pixel, conversions api, woocommerce, tiktok
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.9.2
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect Meta Pixel, Google Analytics and TikTok, with server events, WooCommerce tracking, custom events and consent controls.

== Description ==

Arif PixelPair brings your WordPress tracking into one workspace. Connect Meta, Google Analytics, Google Tag Manager and TikTok, choose what to track, and inspect server delivery results from your dashboard.

A skippable setup wizard helps you choose connections, paste IDs, check configuration and exclude your own visits. Paste a Meta or Google code snippet and PixelPair extracts the supported ID for you.

Tracking starts disabled. You choose which connections and events to enable.

Arif PixelPair is independently developed by Arif Hasnat. It integrates with Meta, Google Analytics, Google Tag Manager, TikTok, WooCommerce and Easy Digital Downloads. It is not affiliated with or endorsed by those services or their owners.

= Connections =

* Meta Pixel and Conversions API.
* Google Analytics 4 and Google Tag Manager.
* TikTok Pixel and Events API.
* Shared event IDs for supported browser/server events.
* Encrypted credentials, retries and redacted logs.

= Events and stores =

* Automatic event controls for pages, search, forms, accounts and engagement.
* Custom rules for button clicks, page visits, scroll depth and other supported triggers.
* Per-platform event mappings and payload previews.
* WooCommerce product, cart, checkout and paid purchase tracking, including supported Blocks flows and HPOS.
* Easy Digital Downloads tracking for supported download, cart, checkout and purchase flows.
* Configurable product identifiers and purchase values.

WooCommerce and Easy Digital Downloads are optional. Their own WordPress and PHP requirements also apply. See the store guide for supported combinations and delivery limits.

= Privacy and administration =

* Consent integrations and a setting to wait for explicit marketing consent.
* Role, IP address, CIDR and bot exclusions.
* Fast cache mode and optional strict visitor eligibility checks.
* Configuration import and export that never includes secrets.
* Per-site settings on WordPress multisite.
* Optional authenticated access for external AI tools through the WordPress MCP Adapter.

PixelPair has no telemetry, advertisements or upsells. Enabled tracking connections communicate with the external services described below. It does not guarantee platform acceptance, attribution accuracy or compliance with privacy laws.

[Getting started](https://github.com/arifhasnat3po/pixelpair-plugin/blob/main/docs/guides/getting-started.md) | [Documentation](https://github.com/arifhasnat3po/pixelpair-plugin/blob/main/docs/README.md) | [Screenshots](https://github.com/arifhasnat3po/pixelpair-plugin/blob/main/docs/screenshots.md)

= Consent and personal data =

When no consent tool is detected, marketing consent is granted by default. Enable "Wait for marketing consent" and configure a supported consent integration if you need visitors to opt in. When a consent tool is detected, unresolved or denied consent blocks the relevant tracking.

Depending on enabled settings, event data can include page URLs and titles, referrers, search strings, product identifiers, cart or order totals, IP addresses, user agents, browser identifiers and attribution. Optional advanced matching uses hashed contact fields. Hashing does not make contact data anonymous.

Consented collection uses first-party browser, click and visitor identifiers. PixelPair's Meta and visitor cookies expire after 90 days, and its TikTok click identifier after 30 days. Vendor scripts manage their own cookies. Session storage can hold attribution and event counters. See the bundled documentation for queue/log retention and deletion controls.

= External services =

**Meta**

When enabled and marketing consent allows, the browser loads the official Meta Pixel script from connect.facebook.net. Server events are sent to graph.facebook.com using your Pixel ID and access token. Meta can receive event names, page and product details, values, IP addresses, user agents, browser/click identifiers and optional hashed matching fields. Requests occur for permitted tracked actions, authorized connection tests and queued retries.

[Meta terms](https://www.facebook.com/legal/technology_terms) | [Meta privacy policy](https://www.facebook.com/privacy/policy/)

**Google Analytics and Google Tag Manager**

When enabled and the required consent is granted, Google scripts load from googletagmanager.com or your configured HTTPS tagging domain. Google Analytics receives page/event data and consent signals. Tag Manager executes your published container, which can contact additional services according to the tags you configure. Review those tags separately. PixelPair uses basic consent mode and does not load Google scripts before the required grant.

[Google Analytics terms](https://marketingplatform.google.com/about/analytics/terms/us/) | [Google Tag Manager terms](https://www.google.com/analytics/tag-manager/use-policy/) | [Google privacy policy](https://policies.google.com/privacy)

**TikTok**

When enabled and marketing consent allows, the browser loads the TikTok Pixel script from analytics.tiktok.com. Server events are sent to business-api.tiktok.com using your credentials. TikTok can receive page, product and event details, values, IP addresses, user agents, browser/click identifiers and optional hashed contact fields. Requests occur for permitted tracked actions, authorized connection tests and queued retries.

[TikTok business terms](https://ads.tiktok.com/i18n/official/policy/business-products-terms) | [TikTok privacy policy](https://www.tiktok.com/legal/page/row/privacy-policy/en)

**Optional AI access**

PixelPair does not contact an AI provider itself. External clients connect to your site using WordPress Application Passwords over HTTPS and require the manage_pixelpair capability. Optional AI access requires WordPress 6.9 or later and the official WordPress MCP Adapter.

== Installation ==

1. Download the built pixelpair.zip release.
2. In WordPress, open Plugins > Add New > Upload Plugin.
3. Select pixelpair.zip, choose Install Now, then activate PixelPair.
4. Open PixelPair and follow the setup wizard.
5. Choose your connections, paste IDs and add server credentials if needed.
6. Configure Privacy, enable your desired tracking and clear your page cache.
7. Visit your site and verify events with the platform's tools.

To update, upload the newer built ZIP and choose to replace the installed version. Replacement preserves settings. Composer and Node.js are not required on your WordPress host.

== Frequently Asked Questions ==

= Do I need WooCommerce? =

No. Page, automatic and custom event tracking work without a store plugin. Store controls appear when WooCommerce or Easy Digital Downloads is active.

= Does tracking start when I activate PixelPair? =

No. Enable a valid connection first. Events also depend on eligibility checks and the connection's required consent categories. With no detected consent tool, marketing is granted by default unless you enable "Wait for marketing consent".

= Which consent tools are supported? =

WP Consent API, Cookiebot, Complianz, CookieYes, Borlabs Cookie v3 and Real Cookie Banner have adapters. Borlabs and Real Cookie Banner require the matching service identifiers. Verify the integration with your installed consent-plugin version before using it on a live site.

= How do I know tracking works? =

Overview shows connection configuration and warnings. Check connection reports the available test result. Activity shows enabled server diagnostics with redacted details. Verify browser events and server acceptance in Meta Events Manager, Google Analytics DebugView or TikTok Events Manager. A configured connection alone does not prove receipt.

= Does PixelPair work with caching? =

Fast mode checks roles and page context during page rendering and requests uncached eligibility only when IP exclusions are configured. Use Strict cache mode if your cache serves shared pages to logged-in visitors. Clear the page cache after changing tracking settings or consent integrations.

= Are access tokens included in exports? =

No. Configuration exports exclude secrets. Enter credentials separately after importing on another site.

= What happens when I deactivate or delete the plugin? =

Deactivation stops PixelPair jobs and keeps its data. Deletion removes its data unless "Keep settings on uninstall" is enabled. Multisite retention is handled separately for each site.

== Screenshots ==

1. Overview with connection statuses and next actions.
2. Setup wizard for choosing tracking connections.
3. Meta connection settings with optional server events.
4. Automatic event controls grouped by purpose.
5. Custom event builder with trigger rules and platform mappings.
6. WooCommerce event and value settings.
7. Privacy settings for consent and tracking exclusions.
8. Activity with redacted server diagnostics.

Screenshots use demonstration data and do not represent live account results.

== Changelog ==

= 0.9.2 =
* Clarify the independent project name and third-party service integrations.
* Limit consent recommendations to PixelPair screens and hide resolved recommendations.
* Limit migration errors to relevant management screens.
* Update documentation, translation source and directory graphics.

= 0.9.1 =
* Remove arbitrary script insertion and execution for the WordPress.org distribution.
* Add WooCommerce and Easy Digital Downloads tracking and TikTok browser/server events.
* Include the finalized WordPress.org readme and automatic translation loading.
* Add setup, secret-free configuration transfer, privacy tools and optional authenticated MCP access.
* Introduce focused connection screens, a sentence-style event builder and unsaved-change protection.
* Add store controls and HPOS-safe purchase attribution with persistent purchase claims.

== Upgrade Notice ==

= 0.9.2 =
Use the built ZIP to update. Review consent settings, clear page caches and verify your enabled connections after upgrading.

== Credits ==

Arif PixelPair is built by Arif Hasnat.
