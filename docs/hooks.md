# Implemented hooks

All callbacks must avoid exposing visitor data in cacheable HTML. PHP hooks run in the current site's context. The hooks below cover browser, server, custom-event and store integrations.

| Hook                             | Input / return                                         | Behavior                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixelpair_platforms`            | `array<string, PlatformInterface>` → array of adapters | Register/replace/remove adapters. Evaluated for rendering and current gate decisions. `render_base_code()` outputs a public JSON fragment captured by EventManager. The browser dispatcher implements Meta, GA4 and GTM. An additional adapter also needs an explicit browser transport. |
| `pixelpair_should_track`         | `bool $allowed`, `string $source_url` → bool           | Veto otherwise eligible visitors. A true return does not bypass built-in exclusions. Fast render and gate paths evaluate it; strict mode evaluates visitor policy at the gate.                                                                                                           |
| `pixelpair_bot_user_agents`      | `list<string>` → list of literal substrings            | Case-insensitive server/browser bot matching. Do not return visitor-dependent strings; this public list is cached in HTML.                                                                                                                                                               |
| `pixelpair_cache_preloaders`     | `list<string>` → list of literal substrings            | Preserve inert config during cache warming. This does not exempt a browser or gate from bot/consent checks.                                                                                                                                                                              |
| `pixelpair_consent_tools`        | `list<string>` → tool hints                            | Add site-level detection for a CMP not otherwise detected. An unresolved hint blocks the default grant. Do not add visitor data.                                                                                                                                                         |
| `pixelpair_consent_marketing`    | `null` → null/bool                                     | Null keeps the default policy. False is a server veto. True affirms a server decision but never overrides a browser denial or unresolved browser CMP. For a client grant, use a supported CMP or the event below. Visitor-specific decisions require strict mode on shared caches.       |
| `pixelpair_bootstrap_rate_limit` | `int` (60) → positive int                              | Maximum gate requests per connection IP per minute, shared across browsers on that IP. Best-effort transients, not an atomic security boundary.                                                                                                                                          |

Example of an additional site-wide bot signature:

```php
add_filter( 'pixelpair_bot_user_agents', static function ( array $agents ): array {
    $agents[] = 'ExampleCrawler';
    return $agents;
} );
```

Example of a custom CMP bridge, called only with a real, resolved decision, after PixelPair has loaded and whenever that decision changes:

```js
document.dispatchEvent(
	new CustomEvent( 'pixelpair:consent', { detail: { marketing: true } } )
);
```

Use `false` for withdrawal/denial. A custom grant cannot mask a detected CMP's denial. The event is a browser integration contract, not authentication. If the bridge only emits once before PixelPair loads, that event cannot be replayed: integrate through WP Consent API for a persistent readable state, or emit after tracker initialization. The eligibility gate serves public configuration only. The separate event collector rechecks the declared consent decision, exclusions and configured event allow-list before accepting a CAPI event.

The `wp_ajax_pixelpair_bootstrap` and `wp_ajax_nopriv_pixelpair_bootstrap` actions are transport handlers, not event ingestion APIs. The `admin_post_pixelpair_dismiss_consent` action verifies capability and nonce. Never put administrator REST nonces into public page configuration.

Server delivery exposes `pixelpair_event_rate_limit` (integer, default 60/minute/IP, independent of the bootstrap budget), `pixelpair_user_data` (raw matching fields before normalization/hashing, only with advanced matching enabled), `pixelpair_event_params` (parameters plus configured internal event name), `pixelpair_event_before_dispatch` (an Event instance; return a non-Event to veto), and `pixelpair_meta_ldu` (boolean plus Event, or null when preparing public browser configuration). The current collector validates the public event name before hooks run. Integrations run as trusted PHP code and must preserve consent and cache boundaries. See [CAPI operations](capi.md).

Consent integrations expose `pixelpair_consent_statistics` with the same null/boolean contract as marketing. Custom browser bridges may pass both `{ marketing: true, statistics: true }` or update either category independently. GTM requires both categories.

Automatic and custom events use configured internal keys (`search`, `form_submit`, `sign_up`, `login`, `comment`, `file_download`, `scroll_depth`, `time_on_page`, `not_found`, `outbound_link`, `custom_<id>`). Trusted PHP code can construct an `Event` with raw user data; the Meta payload builder normalizes/hashes it. Browser clients cannot select a Meta event name or destination. `/events` CRUD and export routes require capability plus nonce; `/context` is a bounded same-origin consented exception that resolves the current signed-in actor without public nonces.

Commerce adds `pixelpair_content_id( string $id, WC_Product $product, string $provider )` to filter a catalog identifier and `do_action( 'pixelpair_purchase_event', $woo_order_id )` to request an eligible paid WooCommerce purchase. The purchase hook still enforces captured consent, renewal settings and persisted deduplication. Internal commerce keys use `woo_` or `edd_` prefixes and are rejected by the general `/event` collector; authoritative data must come through store hooks or `/commerce`. See [commerce behavior and tests](commerce.md).

## Privacy and AI

PixelPair registers WordPress personal-data exporters and erasers for owned WooCommerce/EDD attribution. The official abilities hooks register the pixelpair category and ten bounded management tools; see docs/mcp.md. Scripts are intentionally excluded from abilities and portable configuration.
