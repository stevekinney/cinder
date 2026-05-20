# ToastRegion · accessibility

See [`./toast-region.md`](./toast-region.md) for the call-site usage guide (`useToast()`, `ToastOptions`, dismiss patterns).

## Pattern

Two stacked aria-live regions per [WAI-ARIA Authoring Practices: Alert and Status](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) plus the WCAG 2.x guidance on dynamic notifications. Cinder splits announcements by priority so high-urgency toasts interrupt while informational ones queue politely.

## Two regions, two priorities

| Variant             | Region                                      | aria-live   | role     |
| ------------------- | ------------------------------------------- | ----------- | -------- |
| `info`, `success`   | `.cinder-toast-region__channel` (polite)    | `polite`    | `status` |
| `warning`, `danger` | `.cinder-toast-region__channel` (assertive) | `assertive` | `alert`  |

Both regions carry `aria-atomic="true"` and `aria-relevant="additions"`. They render in the same visual position but route announcements through independent live-region queues so a `success` toast and a simultaneous `danger` toast don't collapse into a single ambiguous announcement.

## Region scope

State is owned by the `<ToastRegion />` instance via Svelte context — there is no process-global singleton. `useToast()` returns the API for the nearest enclosing region. Apps with multiple regions (e.g. a global region plus a modal-scoped region) get independent queues.

## SSR

The region renders nothing on the server. The internal `hydrated` gate flips to `true` on first client effect, after which the region paints. SSR markup is therefore guaranteed empty regardless of programmatic toast calls before mount (such calls are no-ops because no region context exists yet).

## Stack policy

Each region holds at most `maxStack` toasts (default 5). Overflow drops the oldest. Auto-dismiss timers expire after `defaultDuration` ms (default 5000); pass `duration: 0` to make a toast sticky.

## Deduplication

Calling `show(message, { id })` with an id that's already active replaces the existing entry instead of stacking a duplicate. Useful for retry-style toasts where you want to update the same notification rather than spam the user.

## Action button

When `options.action` is supplied, the toast renders an inline button after the message. Clicking it invokes the callback and dismisses the toast (set `keepOpen: true` to keep it). The button is a real focusable element inside the live region; screen readers announce the message and the button is then reachable via Tab.

## Dismiss

Each toast has a dismiss button (`aria-label="Dismiss notification"`) unless `dismissible: false` was passed.

## Reduced motion

The slide-in animation is disabled under `prefers-reduced-motion: reduce` (the entire animation is skipped, not slowed). Toast appearance and dismissal are immediate.

## Teardown

When the region unmounts, all auto-dismiss timers are cleared (`onDestroy`). Tests using the lifecycle helper from `src/test/lifecycle.ts` should observe no leaked timers after region unmount.
