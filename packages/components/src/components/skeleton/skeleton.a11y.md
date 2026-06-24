# Skeleton · accessibility

## Pattern

Skeleton communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Decorative placeholder block that reserves layout space while real content loads.

## Use when

- Reserving the rough shape of incoming content during an initial fetch to avoid layout shift.
- Indicating progressive load of cards, rows, or media tiles where the final shape is known.

## Avoid when

- Indicating indeterminate background work without a known target shape — use spinner.
- Communicating that a view has no data at all — use empty-state.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Skeleton, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Skeleton accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Skeleton in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `spinner`, `empty-state`, `progress`.
