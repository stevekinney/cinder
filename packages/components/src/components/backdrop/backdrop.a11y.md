# Backdrop · accessibility

## Pattern

Backdrop presents layered content. Keep trigger, focus movement, dismissal, and labelling in one predictable interaction path so users can enter and leave the layer without losing context.

Purpose: Full-viewport fixed scrim primitive for custom overlay patterns such as loading dimmers and image lightboxes.

## Use when

- Providing a full-screen dimming layer behind a custom overlay that is not modal, drawer, or sheet.
- Building a loading state that dims the full viewport while an async operation runs.

## Avoid when

- Interrupting the user for a decision — use modal or alert-dialog which manage focus and Escape automatically.
- Showing a side panel — use drawer instead.
- Showing structured content in a dialog — use modal, drawer, or sheet, which render their own native `<dialog>::backdrop` scrim.

## Keyboard and focus

The trigger should remain reachable by keyboard, and the open layer should provide a clear Escape, close, or outside-interaction path consistent with the component documentation.

Keep focus indicators visible. If you wrap or restyle Backdrop, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Backdrop accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Backdrop in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `modal`, `drawer`, `sheet`.
