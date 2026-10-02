# Store tracking

Activate WooCommerce, configure at least one platform, then open **PixelPair → Store**. Tracking is off until enabled. Select ID or SKU, optional prefix/suffix, parent versus variation IDs, value components, a percentage for non-purchase values, and the events to send. A variation without its own SKU uses its own ID unless parent IDs are selected. Product lists are capped at 200 and sent to GA4 only.

The WooCommerce integration supports classic Ajax buttons, non-Ajax/grouped forms, variations, Store API additions, Cart/Checkout Blocks and HPOS. Prices, discounts, currency and order totals come from WooCommerce. The public commerce endpoint accepts catalog identifiers and validated checkout selections, never browser prices, customer IDs or billing fields. It requires same-origin requests, current consent and exclusions. A paid receipt requires the exact order key and, for an account order, the matching signed-in account. Keys and matching data are not included in PixelPair's response or cached configuration.

**Add-to-cart source:** Server hook queues server delivery as soon as WooCommerce confirms the addition. Browser confirmation waits for the next consented browser request but still uses the confirmed hook snapshot. Both modes use the same persisted ID for each addition. Failed button clicks do not produce an event.

**Purchases:** receipt visits and paid-order callbacks share a persisted UUID. Atomic claims allow one browser event per order and destination. The optional server safety net runs after 60 seconds through WP-Cron; configure a reliable cron runner on low-traffic sites. The server queue coordinates concurrent inserts and bounded retries; vendor deduplication uses the same event ID. This is not a promise of global exactly-once delivery: blocked SDKs, closed tabs, lost responses or vendor outages can lose a browser event. A receipt claim is consumed before returning its response. Credentials or destination changes do not replay old orders to a new destination.

Unpaid orders are not tracked as purchases. Automatic subscription renewals are excluded unless enabled. Turning off an event or platform cancels queued delivery when its worker runs. Previously accepted or delivered vendor events cannot be recalled. Consent captured at checkout can support the server safety net for up to 30 days, subject to the current site-wide consent override and the order owner's current excluded roles. Each queued purchase rechecks that eligibility. Current advanced-matching settings also apply to already-queued contact hashes.

A known denial received on an authorized receipt cancels retained consent and pending work for that purchase. An unresolved consent tool waits without permanently revoking it. A later grant does not resend a previously revoked purchase. WordPress personal-data erasure clears the order's retained context and cancels its pending/retry payloads. A background job cannot independently read a visitor's CMP state on another device; integrate changes through the server consent filter when that is required.

Order attribution uses the first consented session landing page, source, UTMs and marketing click IDs. WooCommerce order metadata stores attribution and an encrypted consent/matching snapshot. Optional billing matching is hashed before it enters that encrypted snapshot. The order screen uses WooCommerce CRUD, including HPOS. Hiding the attribution box does not erase stored data. A 30-minute first-party `pixelpair_commerce_consent` cookie carries category decisions only, never customer identifiers. Short-lived cart snapshots expire after ten minutes; catalog/cart identity rows expire after two days. Purchase identity hashes remain to prevent late duplicates.

`{woo_cart_total}` in a custom rule is resolved through a fresh consented cart request. When commerce tracking is disabled or consent is absent it remains unresolved. Product and cart snapshots are requested only after consent and platform readiness. Cached HTML contains public catalog context; never cache cart, checkout or receipt output produced by the store itself.

Refund delivery is not implemented. Google Analytics server delivery is not included. TikTok and Easy Digital Downloads are supported; see [integrations](integrations.md).

## Test fixtures

The base PHP suite intentionally excludes `commerce`, `edd`, `mcp` and `multisite`; each has a separate supported fixture. The base browser suite excludes `commerce.spec.js`. Enable it with `PIXELPAIR_TEST_STORES=1` and set `PIXELPAIR_PHP`, `PIXELPAIR_WP_CLI`, `PIXELPAIR_TEST_WP_ROOT`, `PIXELPAIR_TEST_URL` (and `PIXELPAIR_CHROME` when using an installed Chromium browser). **Use a disposable site with `WP_ENVIRONMENT_TYPE=local` only.** The fixture creates products, coupons, pages and a test-only payment/mail shim; it must never run on a production store.

```sh
vendor/bin/phpunit --group commerce
node scripts/commerce-concurrency.mjs
PIXELPAIR_TEST_STORES=1 npx playwright test tests/e2e/commerce.spec.js
```

The current store fixture pins WooCommerce 11.1.2 on WordPress 7.1.2 / PHP 8.3. WooCommerce 11.1.2 requires WordPress 7.0 or later; pairing it with PixelPair's WordPress 6.2 floor is unsupported. Test the base plugin separately there. The automated compatibility workflow runs wp-env with MySQL. Vendor requests are intercepted; passing tests do not establish acceptance by Meta Events Manager or Google Analytics.
