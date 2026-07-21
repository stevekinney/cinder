# ToastRegion · accessibility

See [`./toast-region.md`](./toast-region.md) for the call-site usage guide (`useToast()`, `ToastOptions`, dismiss patterns).

## Pattern

Two stacked aria-live regions follow [WAI-ARIA Authoring Practices: Alert and Status](https://www.w3.org/WAI/ARIA/apg/patterns/alert/). They also align with [WCAG status message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) for dynamic notifications. Cinder splits announcements by priority so high-urgency toasts interrupt while informational ones queue politely.

## Two regions, two priorities

| Variant                      | Region                                      | aria-live   | role     |
| ---------------------------- | ------------------------------------------- | ----------- | -------- |
| `info`, `success`, `warning` | `.cinder-toast-region__channel` (polite)    | `polite`    | `status` |
| `danger`                     | `.cinder-toast-region__channel` (assertive) | `assertive` | `alert`  |

Both regions carry `aria-atomic="true"` and `aria-relevant="additions"`. They render in the same visual position but route announcements through independent live-region queues so a `success` toast and a simultaneous `danger` toast don't collapse into a single ambiguous announcement.

## Region scope

State is owned by the `<ToastRegion />` instance via Svelte context — there is no process-global singleton. `useToast()` returns the API for the nearest enclosing region. Apps with multiple regions (e.g. a global region plus a modal-scoped region) get independent queues.

## SSR

Wrapped children render normally on the server, and the toast context is available to descendants during SSR. The fixed live-region overlay is the client-only part: the internal `hydrated` gate flips to `true` on first client effect, after which the polite and assertive channels mount.

## Stack policy

Each region holds at most `maxStack` non-leaving toasts (default 5). Overflow dismisses the oldest through the same exit path as a user dismissal. Auto-dismiss timers expire after `defaultDuration` ms (default 5000); pass `duration: 0` to make a toast sticky.

Hovering or focusing the region pauses active auto-dismiss timers for the whole stack. This matters for keyboard users: once focus enters a toast action or dismiss button, the notification will not disappear while the user is reading or acting on it.

## Deduplication

Calling `show(message, { id })` with an id that's already active replaces the existing entry instead of stacking a duplicate. Replacement searches both live-region channels, so an `info` toast can become a `danger` toast without leaving an orphan in the polite region.

`toast.promise()` uses the same id replacement path. Loading toasts are polite and sticky; rejected promises resolve into the assertive `danger` region. Late promise settlements are ignored if the loading toast was dismissed or superseded.

## Action button

When `options.action` is supplied, the toast renders an inline button after the message. Clicking it invokes the callback and dismisses the toast (set `keepOpen: true` to keep it). The button is a real focusable element inside the live region; screen readers announce the message and the button is then reachable via Tab.

## Dismiss

Each toast has a dismiss button (`aria-label="Dismiss notification"`) unless `dismissible: false` was passed. Dismissible toasts also respond to Escape when focus is inside the toast and to horizontal swipe gestures. Escape stops propagation so a parent modal or overlay does not close at the same time.

`dismissible: false` disables only user dismissal affordances. Programmatic `dismiss(id)`, `dismissAll()`, overflow, and action default-dismiss still remove the toast.

When a focused toast is dismissed by a user action, focus moves to the next non-leaving toast control. If no toast control remains, focus moves to `document.body`. Auto-dismiss and overflow do not move focus.

## Reduced motion

The slide-in and exit animations are disabled under `prefers-reduced-motion: reduce` (the entire animation is skipped, not slowed). Toast appearance and dismissal are immediate.

## Teardown

When the region unmounts, all auto-dismiss timers are cleared (`onDestroy`). Tests using the lifecycle helper from `src/test/lifecycle.ts` should observe no leaked timers after region unmount.
