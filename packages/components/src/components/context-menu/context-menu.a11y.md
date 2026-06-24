# ContextMenu · accessibility

## Pattern

ContextMenu presents layered content. Keep trigger, focus movement, dismissal, and labelling in one predictable interaction path so users can enter and leave the layer without losing context.

Purpose: Right-click and long-press menu positioned at the user's pointer while reusing dropdown menu parts.

## Use when

- Providing contextual actions for a canvas, list row, file, or selected item.
- Opening a menu from a pointer location instead of a visible dropdown trigger.

## Avoid when

- The menu should open from a button — use dropdown.
- Showing arbitrary rich content rather than menu actions — use popover.

## Keyboard and focus

The trigger should remain reachable by keyboard, and the open layer should provide a clear Escape, close, or outside-interaction path consistent with the component documentation.

Keep focus indicators visible. If you wrap or restyle ContextMenu, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ContextMenu accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ContextMenu in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `dropdown`, `dropdown-menu`, `dropdown-item`.
