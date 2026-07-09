# ConnectionIndicator accessibility

## Pattern

`role="status"` polite live region. ConnectionIndicator is inherently about a value that changes over time (a transport moving through `connecting` → `live` → `reconnecting`, etc.), so unlike `StatusDot`'s static `role="img"` preset, this component is always a live region.

Purpose: Small standalone status pill for a live connection that communicates its current state through an icon, a text label, and (for `live`) a pulsing dot — never through color alone.

## Use when

- Surfacing the transport-level health of a websocket, SSE stream, or polling loop as a compact, self-contained pill in app chrome or a toolbar.
- Distinguishing push (`live`) from interval polling (`polling`) so operators don't mistake one for the other.

## Avoid when

- Annotating a static entity's state (a row, a user, a deployment) rather than a live transport — use `status-dot` instead.
- Rendering a full event log with per-event connection transitions — use `event-stream-viewer` instead.

## Keyboard and focus

The root `div` is not focusable and receives no keyboard interaction. ConnectionIndicator is read-only, presentational status output — it never owns an interactive control. If a consumer wraps it in a button or link to expose a "reconnect now" action, that wrapper (not this component) owns the focus and keyboard contract.

## Names, roles, and state

The root element carries `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`. The accessible name is computed as `Connection: {label}` (e.g. `"Connection: Live"`, `"Connection: Reconnecting"`), where `{label}` is either the `label` prop override or the default text for the current `status`. An explicit `aria-label` always wins over the computed name.

Status is never conveyed by color alone (WCAG 1.4.1):

- Every state renders its own lucide-svelte icon (marked `aria-hidden="true"` — it is decorative; the label text carries the meaning) alongside a visible text label.
- `live` additionally renders a small pulsing dot span. The dot is `aria-hidden="true"`; it is a supplementary visual cue, not an independent source of meaning.
- `polling` is deliberately quieter than `live`: no motion, a lighter (`--cinder-font-normal`) label weight, and its own icon (`RefreshCcwDot` vs. `live`'s `Wifi`) — so it reads as distinct even in grayscale or forced-colors rendering where the color difference between `polling` and other muted states disappears.

`reconnecting` accepts an optional `attempt` snippet, rendered as visible text inside the pill (e.g. "attempt 3 of 5"). It is not folded into the `aria-label` computation (a snippet's rendered markup cannot be safely stringified into an attribute), but because the root is a polite live region, assistive technology still picks up the attempt text as part of the region's content when it mounts or updates.

## Mouse / pointer

None. The pill has no pointer interaction of its own.

## Hard scope caps

- ConnectionIndicator does not poll, reconnect, or manage any connection itself. It is purely presentational — the host application computes `status` and passes it in.
- Because the root is `aria-live="polite"`, rapid `status` flapping (e.g. a connection cycling `live` → `reconnecting` → `live` several times a second) will queue multiple announcements. Consumers with a flappy transport should debounce `status` upstream before handing it to this component.
- The component does not expose a manual "reconnect" action. Compose it next to a `Button` if the host application needs one.

Related components: `status-dot`, `event-stream-viewer`, `badge`.
