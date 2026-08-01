# Tabular component boundaries

Decision: preserve `Table`, `DataTable`, and `DataGrid` as separate public
families. They overlap in presentation, but their semantic and interaction
contracts are intentionally different; consolidation would make the simplest
use cases pay for the most complex behavior.

## Responsibilities

- **Table** owns native HTML table semantics and composition. Use it when
  consumers need custom cell, row, header, spanning, or nested markup while
  retaining `<table>`, `<thead>`, `<tbody>`, and scoped header semantics. It
  does not own data fetching, virtualization, or grid-style cell focus.
- **DataTable** owns the data-driven convenience contract over native table
  markup. Use it when columns and rows are runtime data and callers want
  generated captions, scope attributes, sorting, optional row selection, and
  fixed-height row virtualization for large append-only datasets. Avoid it when
  cells require bespoke composition or interactive grid behavior.
- **DataGrid** owns interactive ARIA `grid` behavior. Use it for row/cell
  focus, keyboard navigation, range selection, stable row identity, column
  sizing/pinning, and optional row/column virtualization. It is not a native
  table and should not replace semantic tables for read-only tabular content.

Virtualization belongs to DataTable only for its fixed-height append-only mode
and to DataGrid for interactive row/column windows. Selection in DataTable is
row-checkbox selection that preserves native table semantics; DataGrid owns
cell/range selection and grid keyboard interaction. Interactive editing,
resize handles, and drag-to-reorder remain explicit future capabilities rather
than reasons to blur these boundaries.

## Alternatives and review boundary

Choose the nearest simpler alternative first: use Table for bespoke semantic
markup, DataTable for data-shaped native tables, and DataGrid only when grid
interaction or virtualization requires it. Do not add overlapping features to
one family to avoid choosing another; a proposal that changes these
responsibilities must update this decision and the affected accessibility and
interaction tests first.
