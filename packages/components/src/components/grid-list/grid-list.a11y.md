# GridList · accessibility

## Pattern

GridList presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Responsive grid container that arranges grid-list-item tiles into auto-sized columns.

## Use when

- Presenting a homogenous collection of cards that should reflow into multiple columns.
- Constraining tile minimum widths per breakpoint via the minColumnWidth prop.

## Avoid when

- Comparing rows of structured data — use table instead.
- Stacking dense list rows vertically — use stacked-list-item instead.

## Keyboard and focus

The grid owns the root tab stop and moves the active cell with keyboard commands. Do not put body cells directly in the tab order unless the component documents that behavior.

Keep focus indicators visible. If you wrap or restyle GridList, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When GridList accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render GridList in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `grid-list-item`, `table`.
