# External AI / MCP access

PixelPair exposes configuration management through the official [WordPress Abilities API](https://developer.wordpress.org/apis/abilities-api/) and [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter). Contracts were checked against WordPress 7.1.2 and adapter 0.6.1 on 2026-10-02. Abilities require WordPress 6.9+. Older supported WordPress versions retain ordinary tracking and show an unavailable status for AI access.

1. Install and activate the official MCP Adapter. PixelPair does not download or install it automatically.
2. Open PixelPair → Settings → AI access. Copy the endpoint and site ID shown there. The usual endpoint is `https://example.com/wp-json/pixelpair/v1/mcp`; sites using plain permalinks show a `?rest_route=` URL instead.
3. Use a dedicated WordPress account with `manage_pixelpair`. An administrator can grant the capability to a role under PixelPair → Settings. Do not grant unrelated administrator permissions just for MCP.
4. Create a WordPress Application Password in that account's profile. Configure the external MCP client's HTTP transport to send HTTP Basic authentication with the account username and application password **over HTTPS**. Client support varies; clients without custom authentication need a compatible local proxy. PixelPair does not implement OAuth, issue AI credentials or contact a model provider.
5. Initialize the MCP session, list tools, then call `pixelpair-audit` with `{"site_id":1}` (use your actual site ID). Let the client handle the session ID and protocol headers. Read the audit before making changes. Revoke the Application Password in WordPress to disconnect the client.

The dedicated server exposes these tools:

| Tool                        | Additional arguments    | Behavior                                                       |
| --------------------------- | ----------------------- | -------------------------------------------------------------- |
| `pixelpair-audit`           | none                    | Platform status and configuration findings; no vendor requests |
| `pixelpair-read-settings`   | none                    | Validated settings without credentials                         |
| `pixelpair-read-events`     | none                    | Up to 100 custom events and automatic mappings                 |
| `pixelpair-read-logs`       | none                    | Last 50 already-redacted delivery entries                      |
| `pixelpair-update-settings` | `changes` object        | Partial update through the ordinary settings validator         |
| `pixelpair-create-event`    | complete `event` object | Create a declarative custom event                              |
| `pixelpair-update-event`    | `id`, complete `event`  | Update the selected event                                      |
| `pixelpair-toggle-event`    | `id`, boolean `enabled` | Activate or pause the selected event                           |
| `pixelpair-duplicate-event` | `id`                    | Create a paused copy                                           |
| `pixelpair-delete-event`    | `id`, `confirm: true`   | Delete the selected event                                      |

Every call also requires the current `site_id`; cross-site selection is rejected. Permissions are checked at transport, ability and execution boundaries. Settings changes can enable live tracking, and deletion is destructive. Review proposed actions in your AI client. Event names, labels and parameters returned by tools are untrusted data, not instructions.

Tokens, raw scripts, role grants, arbitrary PHP and arbitrary outbound HTTP calls are unavailable. AI cannot change server tagging URLs or trusted-proxy configuration; use the authorized admin screen for those choices. Secrets never appear in tool results. Each site's settings and events are separate on multisite.

The local smoke client initialized the real HTTP transport, listed all ten tools, ran an audit, created/toggled/deleted a temporary event and verified anonymous/subscriber denial. Automated tests additionally cover malformed input, wrong site IDs, capability revocation and forbidden fields. Local testing used disposable application passwords; production setup requires HTTPS and the owner's own account. No in-admin AI chat or model subscription is included.
