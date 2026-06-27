# DataTable

Data-driven accessible table that renders rows and columns into a real `<table>` with `<caption>`, scoped column and row headers, optional sortable columns, and a horizontal-scroll responsive container.

## Usage

```svelte
<script lang="ts">
  import { DataTable } from '@lostgradient/cinder/data-table';

  const columns = [
    { key: 'name', label: 'Name', rowHeader: true },
    { key: 'score', label: 'Score', sortable: true, align: 'end' },
  ];
  const rows = [
    { name: 'Ada', score: 98 },
    { name: 'Grace', score: 95 },
  ];
</script>

<DataTable {columns} {rows} caption="Class roster" />
```

## Guidance

Set `virtualized` with a fixed `rowHeight` when the table is rendering thousands
of same-height append-only rows. The virtualized path keeps the `<table>`,
`<thead>`, and `<tbody>` semantics intact, sets `aria-rowcount` to the full
logical row count, and annotates mounted body rows with full-table
`aria-rowindex` values. Variable or measured body row heights are out of scope
for this mode.

### Use When

- Rendering a roster, cohort, or assignment view from row/column data with real table semantics.
- Needing sortable columns with screen-reader-announced sort state out of the box.

### Avoid When

- Composing a bespoke table layout with custom cell markup — use the compositional Table family directly.
- Visualizing dense numeric magnitude across two dimensions — use matrix-chart instead.

## Props

<!-- generated:props:start -->

| Prop                     | Type                                             | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caption`                | `string`                                         | no       | —       | Visual caption rendered as a `<caption>` element above the table.                                                                                                                                                                                                                                                                                                                                                                                          |
| `class`                  | `string`                                         | no       | —       | Additional class names merged onto DataTable's root wrapper element (the `<div class="cinder-data-table">` that contains the table). To style the `<table>` itself, target `.cinder-data-table table` from this class.                                                                                                                                                                                                                                     |
| `density`                | `"comfortable"` \| `"condensed"` \| `"spacious"` | no       | —       | Vertical padding density for header and body cells. Defaults to `'comfortable'`.                                                                                                                                                                                                                                                                                                                                                                           |
| `height`                 | `string`                                         | no       | —       | CSS block-size for the virtualized native scroll container. Defaults to `"24rem"` when `virtualized` is true.                                                                                                                                                                                                                                                                                                                                              |
| `overscan`               | `number`                                         | no       | —       | Extra body rows rendered before and after the visible virtualized window. Defaults to 5.                                                                                                                                                                                                                                                                                                                                                                   |
| `rowHeight`              | `number`                                         | no       | —       | Fixed body row height in pixels for virtualized mode. This must match the actual rendered body row height, including density padding and any wrapping introduced by the table content. Defaults to 44.                                                                                                                                                                                                                                                     |
| `scrollable`             | `boolean`                                        | no       | —       | When true, wraps the table in a `.cinder-table-scroll` container that enables horizontal overflow scrolling on small viewports.                                                                                                                                                                                                                                                                                                                            |
| `selectable`             | `"none"` \| `"single"` \| `"multiple"`           | no       | —       | Enables checkbox-based row selection. `"none"` renders no selection controls, `"single"` allows one selected row id, and `"multiple"` allows any number. Selection state is exposed through row checkbox controls; native table rows do not emit `aria-selected`. Defaults to `"none"`.                                                                                                                                                                    |
| `selectAllLabel`         | `string`                                         | no       | —       | Accessible label for the multiple-selection header checkbox.                                                                                                                                                                                                                                                                                                                                                                                               |
| `stickToBottom`          | `boolean`                                        | no       | —       | When true in virtualized mode, appending rows while scrolled to the bottom keeps the newest row pinned in view. Appending while scrolled up does not change the viewport.                                                                                                                                                                                                                                                                                  |
| `stickyHeader`           | `boolean`                                        | no       | —       | When true, the header sticks to the top of the scrolling container.                                                                                                                                                                                                                                                                                                                                                                                        |
| `virtualized`            | `boolean`                                        | no       | —       | When true, renders only the visible `<tbody>` row window plus spacer rows. Requires a fixed row height. This is intended for large, append-only tables such as live logs or event streams.                                                                                                                                                                                                                                                                 |
| `columns`                | `(opaque)`                                       | yes      | —       | Column descriptors defining the headers and cell rendering for each column. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                     |
| `getRowId`               | `(opaque)`                                       | no       | —       | Resolves the stable row id used for selection. Defaults to `row.id` when it is a string or number, otherwise the row's current positional index. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                |
| `isRowSelectionDisabled` | `(opaque)`                                       | no       | —       | Returns true when a row should render a disabled selection checkbox. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                            |
| `rows`                   | `(opaque)`                                       | yes      | —       | Row data. Each entry is read via `column.key` for each column. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                  |
| `rowSelectionLabel`      | `(opaque)`                                       | no       | —       | Accessible label for an individual row selection checkbox. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                      |
| `selectedRowIds`         | `(opaque)`                                       | no       | —       | Bound selected row ids. Arrays stay arrays on update; Sets stay Sets. When omitted, DataTable starts with an empty array. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                       |
| `sort`                   | `(opaque)`                                       | no       | —       | Bound sort state. When the user activates a sortable header cell, this prop is updated with the new `{ column, direction }`. The consumer is responsible for reordering `rows` in response — DataTable does not sort internally. Pass `undefined` initially when no column is sorted; the component will never write back `undefined` itself (sort always toggles to a column). Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-data-table-height`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
