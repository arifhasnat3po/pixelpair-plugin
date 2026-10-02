=== PixelPair – Meta Pixel, Conversions API, GA4 & TikTok for WooCommerce ===
Contributors: [WPORG_USERNAME]
// TODO: Replace with Arif Hasnat's verified WordPress.org username before submission.
Tags: analytics, pixel, conversions
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.9.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Configure pixels, conversion APIs, WooCommerce and EDD tracking with consent controls.

== Description ==

PixelPair provides Meta Pixel and CAPI, TikTok Pixel and Events API, GA4, GTM, automatic events, a custom event builder, WooCommerce and EDD tracking. It includes shared browser/server event IDs, category-specific consent, role/IP/bot exclusions, encrypted credentials, optional advanced matching, retries and redacted logs. Tracking starts disabled. WooCommerce uses verified product and cart values, paid receipt checks, HPOS-safe attribution and persisted purchase claims. Overview provides connection status and a skippable setup wizard. Privileged Head & Footer scripts, secret-free configuration transfer, privacy tools and optional authenticated MCP access are included. No noscript request bypasses consent.

PixelPair has no telemetry, ads, upsells, or remote services of its own. When enabled and permitted, it loads Meta's official https://connect.facebook.net/en_US/fbevents.js script and sends events to Meta. CAPI uses https://graph.facebook.com/v26.0/{pixel_id}/events. Meta may receive the page/referrer URL, IP, user agent, browser/click identifiers and hashed matching fields. Consented collection creates first-party _fbp, _fbc (only with fbclid), and random visitor cookies for 90 days. Advanced matching can use hashed logged-in profile details. See docs/capi.md for data handling, encryption and queue/log retention. Meta terms: https://www.facebook.com/legal/technology_terms and privacy information: https://www.facebook.com/privacy/policy/ .

When enabled and consented, GA4 and GTM load scripts from https://www.googletagmanager.com/ or the owner's configured HTTPS tagging domain. Google Analytics receives page/event data and consent signals; GTM runs the owner's published container. Google terms: https://marketingplatform.google.com/about/analytics/terms/us/ and privacy: https://policies.google.com/privacy . Review every tag in your container. PixelPair uses basic consent mode: no Google loader before the required grant.

Automatic/custom events may include page titles, post IDs/types, terms, search strings, form IDs/titles, link URLs, scroll/time values and session attribution. Disable unwanted context fields in Events. Form-field matching is off by default; when explicitly enabled, email/phone are hashed locally for consented Meta CAPI. Session storage holds consented attribution/counts and once-per-session flags. Successful login/signup/comment flags expire after ten minutes. See docs/events.md and docs/google-consent.md in the source package.


When enabled and marketing consent allows, TikTok loads https://analytics.tiktok.com/i18n/pixel/events.js and sends browser events; Events API calls use https://business-api.tiktok.com/open_api/v1.3/event/track/. TikTok can receive page/product/event details, totals, IP, user agent, _ttp/ttclid identifiers and optionally hashed contact data. PixelPair keeps a consented ttclid cookie for 30 days; the TikTok SDK controls its own _ttp cookie. Terms: https://ads.tiktok.com/i18n/official/policy/business-products-terms and privacy: https://www.tiktok.com/legal/page/row/privacy-policy/en . Review your vendor configuration and obligations.

Optional AI access requires WordPress 6.9+ and the official WordPress MCP Adapter (tested 0.6.1). External clients authenticate with WordPress Application Passwords over HTTPS; every tool checks manage_pixelpair and the site ID. No external AI service is contacted by PixelPair. See docs/mcp.md.

== Installation ==

1. Upload a built PixelPair package to your WordPress plugins directory.
2. Activate PixelPair. Administrators receive the manage_pixelpair capability.
3. Open PixelPair and use the setup wizard to choose platforms and enter IDs.
4. Configure consent and exclusions as needed, then purge your page cache.

For source checkouts, run composer install, npm ci, and npm run build first. See docs/development.md.

To update an existing installation, upload a built release ZIP under Plugins > Add New > Upload Plugin and choose to replace the current version. Then open Installed Plugins and confirm the new version. Replacement keeps your settings; deleting the plugin can remove them. Composer is not required on your WordPress host.

== Frequently Asked Questions ==

= Does this build track visitors? =

Only after you enable a valid platform and eligibility plus its required consent categories allow it. With no detected consent tool, marketing is allowed by default. Enable "Wait for marketing consent" to require an explicit consent integration. A detected consent tool must resolve its decision; unresolved or denied means no tracking. PixelPair shows a dismissible consent-plugin recommendation for EU/UK traffic.

= Which cache mode should I use? =

Fast mode checks roles and page context during PHP rendering. Use it when your cache bypasses logged-in visitors. It makes an uncached eligibility request only when IP exclusions are configured. Strict cache mode checks the current visitor on every eligible page; enable it if your cache shares pages with logged-in visitors. All modes require a cache purge after settings or consent-plugin changes.

= Which consent tools are supported? =

WP Consent API, Cookiebot, Complianz, CookieYes, Borlabs Cookie v3 and Real Cookie Banner are supported through documented APIs. Configure the matching service identifiers for Borlabs and Real Cookie Banner. Recognized tools without a resolved decision stay blocked. API fixtures are tested; live plugin-version checks remain pending.

= Can other plugins send duplicate pixels? =

Yes. PixelPair sends one PageView per permitted document. Other plugins can independently initialize Meta or send events; configure only one tracking integration for each pixel.

= What happens when I deactivate or delete it? =

Deactivation stops PixelPair jobs and keeps its data. Deletion removes settings and capability unless "Keep settings on uninstall" is enabled. Gate rate-limit counters contain only salted address hashes and expire after one minute.

= Is multisite supported? =

Each site has separate options and capabilities. Network activation initializes existing sites in batches and initializes new sites while network-active. Uninstall respects retention independently for each site.

== Changelog ==

= 0.9.0 =
* Add WooCommerce/EDD purchase tracking, TikTok browser/server delivery, privileged scripts, onboarding, configuration transfer, privacy tools and authenticated MCP management.
* Redesign the admin with focused connection screens, sentence-style event rules, shared accessible controls, unsaved-change protection and a skippable setup wizard.
* WooCommerce classic/Blocks product, cart, checkout and paid purchase tracking with HPOS-safe attribution, configurable IDs/values and persistent purchase deduplication.
* Store controls, consented cart parameter and optional server purchase safety net. See docs/commerce.md for supported pairings and delivery limits.

= 0.5.1 =
* Restore plugin startup when the generated Composer loader is missing or unreadable by loading PixelPair's own classes directly.

= 0.5.0 =
* Automatic event controls, form success adapters, safe custom rules, per-platform mappings and contextual parameters.

= 0.4.0 =
* GA4, GTM, container starter export, Google Consent Mode v2 and category-specific CMP adapters.

= 0.3.0 =
* Encrypted Meta CAPI delivery, advanced matching, retries, diagnostics and shared event IDs.

= 0.2.0 =
* Meta browser PageView tracking with browser UUIDs, authenticated settings, consent controls, exclusions, and strict cache mode.

= 0.1.0 =
* Initial development scaffold, admin shell, lifecycle tests, and quality pipeline.

== Credits ==

PixelPair is built by Arif Hasnat.
