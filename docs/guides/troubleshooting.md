# Troubleshooting

## The admin is blank or dependencies are missing

Install **pixelpair.zip** from the [release assets](https://github.com/arifhasnat3po/pixelpair-plugin/releases/latest), not GitHub's source archive. Choose replacement when updating, then open a fresh WordPress admin page. The release includes compiled JavaScript, styles and production autoload files.

If the built package still fails, check the browser console, WordPress debug log and host security rules. Share a redacted error and your WordPress/PHP versions in an issue. Do not include credentials, customer information or a full unreviewed debug log.

## WordPress says “The link you followed has expired”

Sign in again and open a fresh **Plugins → Add New → Upload Plugin** page. Retry with the built ZIP. If it repeats, ask your host to check `upload_max_filesize`, `post_max_size` and web-server upload limits. A host file manager or SFTP can replace the plugin directory after a backup; do not delete it through WordPress to perform an update.

## The connection is enabled but no event appears

1. Verify the saved ID is the destination you are inspecting.
2. Check Privacy for your role/IP exclusions. If you excluded yourself, use a signed-out private window.
3. Resolve the consent banner. A detected tool with no decision blocks tracking.
4. Purge page caches after configuration changes; check Strict cache mode if logged-in visitors receive cached pages.
5. Inspect browser developer tools for a blocked vendor SDK and check for another plugin deploying the same pixel.
6. Use the platform's official helper/test-event tools. A successful configuration check is not proof of browser receipt.

See [Meta verification](../testing-meta.md) for a repeatable staging test.

## A server connection rejects my token

Open the connection's **Fix** or **Manage** action. Confirm the token and Pixel ID belong together, replace the token and save. Check your platform's permissions and token instructions, then run **Check connection** again. Enable Activity logging to inspect a redacted response if needed.

## Activity is empty

Turn on logging and trigger a new eligible server event. Browser-only connections do not produce server delivery entries. Logging cannot recover events from before it was enabled. Your retention policy may also have removed older entries.

## Purchases are missing or repeated

Confirm the order is paid and the receipt is viewed by an authorized visitor. Review Store event toggles, consent, role exclusions and your cron runner. Ensure another plugin is not independently sending the same purchase. Compare event IDs in the destination dashboard before concluding that two browser/server entries represent two conversions.

## Settings cannot be edited after import

An import can succeed while its subsequent settings reload fails. Use **Retry** to refresh the saved state. PixelPair blocks stale forms until that succeeds so they cannot overwrite imported settings.

## Reporting a bug

Include the PixelPair, WordPress and PHP versions, the affected screen, exact steps and the redacted error. Include a screenshot if it helps, after checking it for private information. Report security vulnerabilities privately as described in [SECURITY.md](../../SECURITY.md).
