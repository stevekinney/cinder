# Alert · accessibility

## Pattern

Alert communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Inline status message with assertive role for surfacing time-sensitive feedback about a nearby action or region.

## Use when

- Surfacing the result of a just-completed action such as a save failure or success.
- Calling out a transient condition the user must notice immediately within a specific region.

## Avoid when

- Communicating a page- or app-wide notice that persists across views — use a banner instead.
- Providing supplemental commentary or guidance inline with content — use a callout instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Alert, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Alert accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Alert in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `banner`, `callout`, `toast-region`.
