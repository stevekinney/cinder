# EmptyState · accessibility

## Pattern

EmptyState communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Centered placeholder with optional icon, title, description, and call-to-action for views that have no data to render.

## Use when

- Communicating that a list, table, or workspace has no items yet and suggesting a next step.
- Replacing a primary content region after a filter or search returns no results.

## Avoid when

- Indicating that data is still loading — use skeleton or spinner instead.
- Reporting a transient error — use alert, banner, or toast-region.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle EmptyState, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When EmptyState accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render EmptyState in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `skeleton`, `spinner`.
