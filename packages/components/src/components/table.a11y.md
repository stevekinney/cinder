# Table · accessibility

## Pattern

Native semantic table per [WAI-ARIA Authoring Practices: Sortable Table](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grid-1/) (a simplified, non-grid variant). Cinder's Table does **not** use `role="grid"` — it relies on the implicit roles of `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`.

## Composition

```
<Table bind:sort>
  <TableHeader>
    <TableRow>
      <TableHeaderCell column="name" sortable>Name</TableHeaderCell>
      <TableHeaderCell column="age" sortable>Age</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Alice</TableCell>
      <TableCell align="right">30</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Sortable headers

When a `TableHeaderCell` is `sortable`, it renders a `<button>` inside the `<th>`. Focus and keyboard activation live on the inner button (`Enter` / `Space` activate it natively); `aria-sort` lives on the `<th>` so screen readers announce "ascending", "descending", or "none" alongside the column header text.

Non-sortable header cells render plain text inside the `<th>` with no inner button. Mixing sortable and non-sortable headers in the same row is supported and expected.

## Sort state

The Table owns a bindable `sort` prop of shape `{ column: string; direction: 'ascending' | 'descending' }`. Activating a sortable header:

- If the header's `column` is not the current sort: switches to that column with `ascending` direction.
- If the header's `column` is already the current sort: toggles direction.

Cinder does **not** sort the rows — that's the consumer's responsibility. The bindable lets your data layer react to the new sort.

## Caption

Pass a `caption` prop to render a `<caption>` element above the table. This is the primary accessible name source. Consumers without a visible caption should provide an `aria-label` on the wrapping element.

## Sticky header

Opt-in via `stickyHeader={true}`. Wraps the table in a scroll container and pins `<thead>` to the top via `position: sticky`.

## Non-goals (v1)

- Row selection (no checkbox column, no `aria-selected`).
- Cell editing.
- Pinned columns / column resizing.
- Virtualization — rows render directly. Consumers with very long lists should paginate or use a different component.
- Aggregation, filtering, search.

These are deliberately out of scope; consumers needing them should compose their own grid on top of the primitives or use a dedicated data-grid library.
