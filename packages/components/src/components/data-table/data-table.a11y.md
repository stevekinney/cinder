# DataTable · accessibility

## Pattern

DataTable presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Data-driven convenience wrapper over the compositional Table family that renders a full semantic table from a columns array and a rows array.

## Use when

- Rendering a structured dataset where columns and rows are known at runtime (e.g. API responses, config-driven dashboards).
- You want correct scope=col / scope=row semantics and aria-sort wiring without writing Table.Header / Table.Body manually.

## Avoid when

- You need custom cell rendering, interactive cells, nested components, or column spanning — use the compositional Table family directly.
- You need `aria-selected` on rows — DataTable keeps native table semantics and exposes selection through checkboxes instead.

## Keyboard and focus

Native table reading order is the keyboard contract. Sort controls, when present, are real buttons inside header cells and use `aria-sort` on the header cell.

Keep focus indicators visible. If you wrap or restyle DataTable, verify the focused element remains visually apparent in default and forced-colors modes.

When `resizable` is enabled, each column separator is a focusable `role="separator"` with `aria-orientation="vertical"`, an accessible label, and `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` describing the rendered column width. The table uses fixed layout while resizing so the announced value and visible width remain aligned.

### Keyboard matrix

| Focus target     | Key                    | Result                                                                  |
| ---------------- | ---------------------- | ----------------------------------------------------------------------- |
| Sort button      | Enter or Space         | Applies the next sort state and updates `aria-sort` on its header cell. |
| Column separator | ArrowLeft / ArrowRight | Decreases or increases the column width by 10 pixels within its bounds. |
| Column separator | Other keys             | No resize action; focus remains on the separator.                       |
| Virtualized row  | ArrowUp / ArrowDown    | Moves roving focus to the previous or next rendered row.                |
| Virtualized row  | Home / End             | Moves roving focus to the first or last row.                            |

### Assistive technology and review outcome

The native table, header-cell sort state, row headers, selection checkbox labels, and resize separator values were reviewed against the rendered DOM and keyboard interaction model. Focus remains on the active sort control, resize separator, or virtualized row while its state changes; no operation depends on color or pointer input. Forced-colors focus indicators remain visible through the component and table sidecars. Review outcome: the documented focus and keyboard model is approved for the current alpha component, with callers responsible for preserving the wrapper's focus styles when applying custom table chrome.

## Sortable headers

Sortable columns render a native button inside the header cell. `aria-sort` stays on the `<th>` so assistive technology announces the current state with the column label, and the button exposes an `aria-description` that names the next action: "Activate to sort ascending" or "Activate to sort descending".

DataTable reports sort intent through the bindable `sort` prop. It does not reorder rows by itself; callers must update `rows` after receiving the next sort state.

## Row scanning

The first column acts as the row header by default, or a later column can opt in with `rowHeader: true`. Hover and focus-within row backgrounds use `--cinder-surface-hover` to make wide tables easier to scan without changing the native table semantics.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When DataTable accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render DataTable in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `table`, `table-header`, `table-body`, `table-row`, `table-cell`, `table-header-cell`.
