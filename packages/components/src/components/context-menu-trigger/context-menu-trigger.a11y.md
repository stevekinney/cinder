# ContextMenuTrigger · accessibility

## Pattern

ContextMenuTrigger presents layered content. Keep trigger, focus movement, dismissal, and labelling in one predictable interaction path so users can enter and leave the layer without losing context.

Purpose: Compose-only trigger region that opens a context-menu on right-click or touch long-press.

## Use when

- Wrapping the region that should own contextual actions inside ContextMenu.
- Pairing pointer-positioned menu behavior with dropdown menu items.

## Avoid when

- Used outside context-menu — it requires the ContextMenu provider.
- Opening a normal click menu from a visible button — use dropdown-trigger.

## Keyboard and focus

The trigger should remain reachable by keyboard, and the open layer should provide a clear Escape, close, or outside-interaction path consistent with the component documentation.

Keep focus indicators visible. If you wrap or restyle ContextMenuTrigger, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ContextMenuTrigger accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ContextMenuTrigger in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `context-menu`, `dropdown-trigger`.
