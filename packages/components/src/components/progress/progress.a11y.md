# Progress · accessibility

## Pattern

Progress communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Determinate or indeterminate progressbar rendered as a horizontal bar or ring with full ARIA value semantics.

## Use when

- Reporting measurable progress of a known task such as a file upload or multi-step import.
- Showing an indeterminate work indicator when the task duration is unknown but the surface needs a progressbar role.

## Avoid when

- Showing a small inline busy state next to a control — use spinner.
- Reserving placeholder space for incoming content — use skeleton.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Progress, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Progress accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Progress in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `spinner`, `skeleton`.
