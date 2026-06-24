# Grid · accessibility

## Pattern

Grid affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: CSS grid container for explicit columns, intrinsic auto-fill layouts, and two-dimensional placement.

## Use when

- Building form layouts, card grids, or dashboards that need two-dimensional placement.
- Creating intrinsic responsive grids by passing minItemWidth.

## Avoid when

- Presenting homogeneous gallery tiles - use grid-list instead.
- Packing variable-height content into waterfall columns - use masonry instead.

## Keyboard and focus

The grid owns the root tab stop and moves the active cell with keyboard commands. Do not put body cells directly in the tab order unless the component documents that behavior.

Keep focus indicators visible. If you wrap or restyle Grid, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Grid accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Grid in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `grid-item`, `grid-list`, `masonry`.
