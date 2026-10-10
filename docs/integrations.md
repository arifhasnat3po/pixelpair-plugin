# TikTok and EDD

TikTok is opt-in under Connections → TikTok. Enter the 20-character Pixel ID; enable server delivery and enter an Events API token, then select Save changes. Credentials use a separate protected request within that save action. The token never returns in settings responses. Enable advanced matching only when appropriate for your consent policy. SDK loading and matching wait for marketing consent. Server and browser events share an ID; retries retain that ID. SDK load failures do not claim a successful browser send.

Protocol references checked 2026-10-02: [official Events API template](https://github.com/tiktok/gtm-template-eapi), [official Pixel template](https://github.com/tiktok/gtm-template-pixel), and [Pixel consent mode](https://business-api.tiktok.com/portal/docs/pixel-cookie-consent-mode/v1.3). Events use the fixed v1.3 API endpoint and Access-Token header. Live TikTok acceptance is pending.

EDD tracking uses native 3.x cart/order APIs, variable prices and actual paid-order totals. Order and event identities are separate from WooCommerce. A receipt requires EDD's native authorization; a copied payment key alone does not authorize a guest. Both stores can be installed together. EDD 3.7.1 requires PHP 8.0+ and WordPress 6.7+; it cannot be tested on the plugin's PHP 7.4 / WordPress 6.2 base floor. Renewal delivery is opt-in. Refund delivery is not implemented.

Automated verification uses the real local WordPress 7.1.2, WooCommerce 11.1.2 and EDD 3.7.1 APIs with vendor HTTP/SDK requests intercepted. A paid EDD guest checkout verifies shared Meta/TikTok IDs and no repeat purchase after receipt reload. This does not replace live vendor dashboards or production host checks.
