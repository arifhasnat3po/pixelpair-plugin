# Verify Meta on a staging site

Use a Meta data source you control and a staging site with an appropriate consent configuration. Automated tests intercept vendor traffic; they do not verify your live account.

## Browser PageView

1. Install the built plugin and save a valid Meta Pixel ID in Connections → Meta.
2. Purge caches. Open a fresh visitor window that is not excluded by role or IP.
3. Resolve marketing consent if a tool is active. Before a required grant, confirm no Meta SDK or event request occurs.
4. Grant consent, load the page and inspect Meta Pixel Helper. Confirm the destination ID and one intended PageView for that document.
5. Inspect Events Manager for receipt. Check that another plugin or Tag Manager container is not sending the same pixel again.

## Server delivery

1. Enable Send events from your server too, save a valid token, and set a test event code under Advanced.
2. Run Check connection. Read the actual result and expandable response; do not infer success from a saved token alone.
3. Enable Activity logging, visit a permitted page, and inspect the redacted server outcome.
4. In Meta's dashboard, compare browser and server event IDs. Confirm platform deduplication there; PixelPair's server log cannot establish browser receipt.
5. Turn off test mode when finished. Review log retention and disable diagnostic logging if no longer needed.

## Exclusions and caching

Test a granted visitor, a denied visitor, an excluded logged-in role and an excluded IP. Fast mode assumes the cache bypasses logged-in visitors. Strict cache mode always performs the uncached eligibility request; IP exclusions force it in both modes. Test the mode your production cache requires and purge cached pages after changing it.

Consent withdrawal prevents subsequent PixelPair tracking but cannot retract an already-sent event. Use [server delivery documentation](capi.md) for queue, consent and retry behavior, and [commerce documentation](commerce.md) for purchase verification.
