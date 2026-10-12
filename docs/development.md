# Developing PixelPair

PixelPair includes browser/server connections, automatic and custom events, WooCommerce/EDD tracking, configuration transfer and authenticated MCP access. See [CAPI operations](capi.md) and the [documentation index](https://arifhasnat3po.github.io/pixelpair-plugin/).

## Setup and checks

Use PHP 7.4+, Composer 2, Node 24.21.0, npm 11.16+, Docker and Git. Composer targets PHP 7.4.33. WordPress supplies the React and component packages; the front-end tracker has no WordPress or jQuery dependencies.

```sh
composer install
npm ci
npm run build
npx wp-env start
composer lint
composer analyse
composer test
npm run lint:js
npm run lint:css
npm run format:check
npm run test:unit -- --runInBand
npm run check:front-size
npx playwright install chromium
npx wp-env run cli wp user create subscriber subscriber@example.test --role=subscriber --user_pass=password
npm run test:e2e
```

The development site is http://localhost:8888 and the disposable test site is http://localhost:8889. Default fixture credentials are admin / password and subscriber / password. Never run tests against an existing site: they change settings and roles and create/delete network sites.

WordPress is pinned to 7.1.3. CI also covers 7.0.7 and the 6.2 floor. The compatibility preflight reports unavailable metadata and unsupported PHP pairings explicitly, with no allow-failure entry. The PHP suite uses real installed WordPress APIs. Run the separate multisite job with `composer test -- --group multisite`; it exercises 101-site batching, reactivation, new sites, deactivation, retention and context restoration.

For native disposable installations, set `PIXELPAIR_TEST_WP_ROOT` to the WordPress directory. Set `PIXELPAIR_TEST_HOST` if the network domain differs from localhost. The Docker test wrapper includes port 8889 when booting its network. Native disposable fixtures can use MariaDB; CI runs the pinned wp-env/MySQL and PHP matrix.

Browser tests use `PIXELPAIR_TEST_URL` and optionally `PIXELPAIR_CHROME`. Every Meta URL is intercepted; the SDK stub records calls without sending events. Vendor account verification requires a real staging configuration. Builder API fixtures and URL cases are not claims of commercial-plugin installation tests.

`@wordpress/scripts` 36 uses its documented `test-unit-jest` adapter here. Admin JSX keeps the classic createElement transform for WordPress 6.2 compatibility. PHPCS checks all shipped PHP with WPCS/PHPCompatibilityWP. Narrow comments explain raw protocol reads, downstream nonce checks, and JSON escaping. PHPStan level 6 targets PHP 7.4 with a 1 GB memory budget. Keep the tracker below 15 KB gzip; `npm run check:front-size` enforces it in CI.

## Admin UI

Hash routes and lazy screen modules share controls in `assets/src/admin/components/ui`. Forms keep local drafts and send changed owned keys; immediate list toggles include Undo. Nested options merge against the latest queued saved state. Credential endpoints remain separate, and partial results are reported explicitly. Import locks stale settings until its follow-up read succeeds.

Design tokens live in `_tokens.scss`, and external help destinations live in `links.js`. The bundled `assets/docs/admin-guide.html` remains available from installed packages. No admin web fonts or external component libraries are loaded.

`ui-matrix.spec.js` captures each screen at 1280, 782 and 600 pixels in Light/Coffee and both content directions, checks serious/critical axe findings and overflow, and records usable-content timing. Store fixtures run the same matrix on WooCommerce/EDD. The RTL matrix sets the app direction while retaining an English WordPress shell; it is not a translated-language review. `ui-setup.spec.js` and `ui-usability.spec.js` record machine interaction time and click counts. These measurements do not establish human task time or live vendor receipt.

## Settings and lifecycle

`manage_pixelpair` belongs to site administrators. The version-4 migration adds defaults on activation/admin upgrades without erasing existing settings. Reads merge validated defaults from the autoloaded `pixelpair_settings` option and expose only known fields. Raw JSON types are validated before coercion; failed saves are atomic. GET and POST settings requests require capability plus `X-WP-Nonce`. Credentials are encrypted in a separate nonautoloaded option and are never exported.

Removed roles are omitted from the active exclusion list without resetting other preferences or writing during reads; the next successful save drops those stale role entries. Newly submitted roles must exist. Corrupt storage fails closed for tracking, and partial updates cannot overwrite unrelated preferences with fallback defaults. Saves verify the persisted option, so unchanged saves succeed while rejected writes return an error and the admin app keeps the editable draft.

Network activation initializes 100 sites per batch and schedules further batches. New sites are initialized while network-active. Deactivation clears owned jobs and retains data. Uninstall removes explicitly named settings/version options and capabilities unless per-site retention is enabled; unrelated options survive. Short-lived gate counters expire after one minute and do not contain raw IPs.

For an installable artifact, use the isolated production packaging workflow in [release instructions](release.md). It installs production-only Composer files into a fresh stage, verifies the optimized class map and compiled assets, and writes a deterministic ZIP. The older `stage-artifact.mjs` directory-only helper remains available for development.

Version 0.5.1 repairs startup when `vendor/autoload.php` is absent or unreadable. Composer remains the preferred PSR-4 loader. Because there are no third-party PHP runtime packages, the bootstrap can fall back to loading only valid `PixelPair\` class names from `src/`; it ignores unrelated namespaces and traversal paths. Releases still include production Composer files and compiled assets. Revisit this fallback before adding third-party runtime packages. Composer is a developer tool, not a requirement on a customer's host.

The bootstrap regression runs in a separate PHP process with a copied plugin and no `vendor` directory. It disables other active plugins before WordPress loads, avoiding an inherited Composer loader that would mask the failure. It verifies settings/event service registration, every shipped class's source path, and namespace/path boundaries. Installation acceptance also tests replacement through WordPress, then opens and saves settings with the installed vendor directory removed. Use replacement rather than deletion to preserve settings.

## Fast and strict cache modes

**Fast mode is the default.** PHP checks roles and page contexts when rendering the page. This assumes the cache bypasses logged-in visitors. It makes no extra eligibility request unless IP exclusions are configured. If a cache serves guest HTML to an excluded logged-in visitor, the PHP role check has already been bypassed and tracking can occur. The browser test deliberately demonstrates this limitation.

**Strict cache mode** uses an uncached, cookie-authenticated eligibility request for every otherwise permitted page. It rechecks current WordPress roles, connection IP, user agent, source-page context, settings, platform filters and server consent vetoes. IP exclusions also force this request in fast mode. A rejected, failed or timed-out gate never falls back to tracking. A fresh grant can retry a required gate; repeated grants during a request cannot duplicate it.

The shared HTML contains public Pixel configuration and consent-tool hints only: no visitor ID, IP, role list, email, cookie, nonce or server-generated event ID. Strict mode keeps render configuration neutral between roles. Cache preloader user agents preserve inert configuration; the browser still applies its own bot/consent policy. Plugin render work uses autoloaded options and approved WordPress role/context APIs, with no custom table queries. Tests measure queries after options are loaded.

**Purge page caches after settings, integration or consent-plugin changes in either mode.** Strict mode refreshes the current Pixel ID/enablement at the gate, but cannot upgrade old HTML that omitted the tracker, did not require a gate, or carried stale consent-tool hints. Fast mode without IP exclusions necessarily uses its cached configuration until invalidation. Visitor-specific PHP filters on shared caches require strict mode. Filter values embedded in HTML, such as bot patterns and consent-tool detection, must be site-level.

The read-only Ajax endpoint accepts at most 8 KB of JSON: a same-origin source URL and a consent decision/source. It never accepts browser roles or IPs, sets tracking cookies, ingests events or returns identity data. `REMOTE_ADDR` is authoritative by default. The explicit trusted-proxy option enables X-Forwarded-For only for installations where the proxy replaces that header and blocks direct origin access. Origin (or Referer fallback), URL and method are checked, responses use private/no-store, and permissive CORS headers are removed.

A salted IP-hash transient limits the gate to 60 requests/minute by default. Shared addresses share the budget; use the documented filter to adjust it. Transient increments are best effort, not atomic abuse prevention. Counters are on the uncached path only.

## Consent and browser lifecycle

No detected tool means marketing granted unless "Wait for marketing consent" is enabled. Detected tools must decide first; unresolved or denied means no tracking. A capability- and nonce-protected dismissible notice recommends a consent plugin for EU/UK traffic. This recommendation is not a legal compliance certification.

WP Consent API must expose a resolved optin/optout type before its marketing decision is trusted: its own no-type fallback returns true. Cookiebot requires a response and marketing=true; Complianz uses its marketing API. CookieYes change events work for the vendor's supported connected integration. Borlabs v3 and Real Cookie Banner use configured service IDs and resolved public APIs. See [Google and consent](google-consent.md). See [hooks](hooks.md) and [verification references](testing-meta.md).

The browser creates one cryptographic UUID v4 per permitted document. An empty Meta queue is installed before the official SDK runs; init/PageView are delayed until loading finishes and consent is checked again. Withdrawal during loading blocks a late event; a new grant can resume. A sent PageView cannot be retracted. PixelPair does not disable pixels or consent state owned by other plugins. CAPI and optional advanced matching share the consent gate; first-party cookies are set only by permitted uncached collection. No noscript request or identity logging is added.

## Automatic and custom events

See [event configuration and limits](events.md). Rules live in a site-specific table and compile into an autoloaded public snapshot. Admin mutations serialize through an atomic database lock and invalidate the snapshot; browser page caches still require purging. Current custom rule state is read again for CAPI collection and delivery, so paused/deleted rules cannot authorize stale submissions. WordPress role context and one-use action flags use a consented uncached request only when needed. No custom table query is added to cached rendering.

Version 4 adds the events table. Reactivation restores housekeeping schedules. PHPStan uses analysis-only WP Consent API signatures from its upstream API, never runtime replacements.

Version 5 adds the commerce identity table and disabled WooCommerce/EDD settings. Commerce IDs are generated and persisted by the authoritative store service so browser receipts and asynchronous payment callbacks can share them. Public page rendering still does not query that table. See [store tracking and supported test pairings](commerce.md). WooCommerce stubs are development-only; PHPStan uses a single worker and a 2 GB limit for those upstream signatures. Optional extension tests run separately from the base compatibility matrix.

## Integrations and configuration transfer

See [integrations](integrations.md), [MCP](mcp.md) and [release packaging](release.md) for store and AI integration contracts and release packaging. Configuration transfer replaces settings and custom rules, preserves credentials/grants, validates all input first, and uses a database transaction plus the existing event mutation lock. Import requires transactional tables.

## Identity migration

The PixelPair upgrade copies configuration and credentials per site, keeps the original site-bound decryptor for unprocessed ciphertext, and migrates metadata and queued payloads in resumable batches of 100. The main site's shared lease and group decisions protect the global user-meta table across sites and networks. Existing destination data wins, including a consent withdrawal written concurrently with a batch. Reactivation restores unfinished batch scheduling. Native store readers work before their metadata batch finishes; privacy erasure removes both old and new keys.

Conflicting old/new tables stop both plugin runtimes on the affected site and display an administrator notice. Preserve both copies and resolve the conflict before reloading to retry; the migration never drops a table to make it fit. The temporary old-plugin uninstall-retention guard is removed after metadata completes. This permits deleting the inactive old plugin without losing pending migration data. Purge page caches after the rename because cached HTML may reference the old asset and endpoint paths.

Use MySQL/MariaDB for upgrade acceptance. The tested SQLite adapter does not implement table renaming; the migration detects the failed postcondition and cannot complete there. It is not reported as a supported upgrade pairing. Plainly unreadable ciphertext is retained under its original authenticated format for key recovery, rather than replaced with empty credentials.
