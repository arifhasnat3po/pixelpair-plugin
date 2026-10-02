# Choose what gets tracked

Open **PixelPair → Events**. Automatic events cover common site interactions; Custom events let you define a specific trigger and mapping.

## Automatic events

Find the event by its plain-language name and use its toggle. List toggles save immediately. The confirmation offers **Undo** to restore the previous value.

![Automatic events grouped by purpose](../images/events.png)

Open an event's details to edit its supported mapping or parameters. Use **Show what's sent** to inspect the payload preview. Detail forms use **Save changes**, while the list's on/off switches save immediately.

![Form submission event details](../images/events-automatic-form_submit.png)

The event data screen controls contextual fields such as page information and attribution. Form-field matching is off by default. Ordinary form submission tracking does not mean arbitrary field contents are sent.

![Event data controls](../images/events-data.png)

## Example: track a Book a call button

Use this example when your site's button has the CSS class `book-call-btn`.

1. Open **Events → Custom**, then **New event**.
2. Name it **Clicked Book a call**.
3. For **When**, select **someone clicks** and enter `.book-call-btn` as the element selector.
4. Keep **on any page**, or restrict the URL if that class is used for unrelated buttons.
5. Map the event to **Contact** for Meta. Add other destinations only when needed.
6. Expand **Show what's sent** to review the generated mapping, then **Save and turn on**.

![Custom events list and creation action](../images/events-custom.png)

![Sentence-style custom event builder](../images/events-custom-new.png)

No hand-written payload is needed for this example. Server sending requires the corresponding server connection to be configured. Selector/regular-expression errors appear inline; fix them before saving. Test the actual button while consent is granted and your visitor is not excluded.

Purge shared page caches after saving, pausing or deleting a rule. A deleted or paused rule cannot authorize a new server delivery, but previously cached browser code still needs invalidation. Events already accepted by a platform cannot be recalled.

See [event contracts and supported conditions](../events.md) for trigger types, dynamic parameters, once-per-session behavior and integration limits.
