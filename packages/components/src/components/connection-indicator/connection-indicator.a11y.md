# ConnectionIndicator · accessibility

## Pattern

ConnectionIndicator communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Live-status pill pairing a semantic dot with a label to communicate real-time WebSocket, SSE, or polling connection state.

## Use when

- Surfacing whether a realtime channel is connected, connecting, disconnected, or errored on a dashboard or app chrome.
- Giving operators an at-a-glance health signal for a long-lived transport.

## Avoid when

- Communicating generic semantic state with no realtime connection backing it — status-dot is the lower-level primitive.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle ConnectionIndicator, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ConnectionIndicator accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ConnectionIndicator in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `status-dot`, `spinner`.
