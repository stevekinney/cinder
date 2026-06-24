# DataGrid · accessibility

## Pattern

DataGrid presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: ARIA data grid foundation for spreadsheet-like datasets with explicit row identity, column sizing, keyboard navigation, range selection, and pinning metadata.

## Use when

- Rendering interactive tabular data that will need grid behavior such as selection, virtualization, resizing, or editing.
- You need role=grid semantics instead of native table semantics.

## Avoid when

- You only need a semantic read-only table — use DataTable or the Table family instead.
- You need resize handles, drag-to-reorder controls, or editing today — DataGrid does not provide them yet.

## Keyboard and focus

The grid owns the root tab stop and moves the active cell with keyboard commands. Do not put body cells directly in the tab order unless the component documents that behavior.

Keep focus indicators visible. If you wrap or restyle DataGrid, verify the focused element remains visually apparent in default and forced-colors modes.

## Row headers

Set `rowHeader: true` on the column that identifies each row. Body cells in that column render with `role="rowheader"` instead of `role="gridcell"`, while still preserving `aria-colindex`, selection state, and active-cell behavior.

Use the same row identity users see on screen whenever possible. A first pinned identifier column is a good default because screen readers can announce the row context before the remaining grid cells.

## Virtualized columns

Column virtualization keeps off-screen columns out of the DOM. The grid preserves `aria-colindex` for the full column set and adds edge shadows plus a stable scrollbar gutter so sighted users have a visible horizontal-overflow cue and the vertical scrollbar does not cover the last visible column.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When DataGrid accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render DataGrid in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `data-table`, `table`.
