# Badge · accessibility

## Pattern

Badge presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Compact non-interactive label that annotates an adjacent element with a short status, count, or category.

## Use when

- Annotating a value with a short status word like "new" or "beta".
- Displaying a numeric count next to an icon or title.

## Avoid when

- The label must be interactive or removable — use chip instead.
- Showing only a colored dot for presence — use status-dot instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Badge, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Badge accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Badge in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `chip`, `status-dot`.
