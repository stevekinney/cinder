# DataGrid

ARIA data grid foundation for spreadsheet-like datasets with stable row identity, explicit column widths, keyboard navigation, row selection, cell/range selection, and pinned-column metadata.

## Usage

```svelte
<script lang="ts">
  import { DataGrid } from '@lostgradient/cinder/data-grid';

  const columns = [
    { key: 'id', header: 'Order', width: 120, pin: 'left' },
    { key: 'customer', header: 'Customer', width: 220 },
    { key: 'status', header: 'Status', width: 140 },
  ];

  const rows = [
    { id: 'ORD-1001', customer: 'Ada Lovelace', status: 'Packed' },
    { id: 'ORD-1002', customer: 'Grace Hopper', status: 'Shipped' },
  ];
</script>

<DataGrid {columns} {rows} getRowId={(row) => row.id} aria-label="Orders" />
```

## Guidance

### Use When

- Rendering an interactive tabular surface that needs grid semantics instead of native table semantics.
- You need built-in row selection, cell focus, range selection, and copy behavior before adding virtualization or editing.

### Avoid When

- You only need a semantic read-only table — use DataTable or the Table family instead.
- You need sorting, virtualization, resize handles, drag-to-reorder controls, or editing today.

## Props

<!-- generated:props:start -->

| Prop                     | Type                                           | Required | Default | Description                                                                                                                                           |
| ------------------------ | ---------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                  | `string`                                       | no       | —       | Additional class names merged onto the root grid.                                                                                                     |
| `columnOrder`            | `string`[]                                     | no       | —       | Applies a supplied column order.                                                                                                                      |
| `columnSizing`           | `object`                                       | no       | —       | Overrides resolved column widths by column key.                                                                                                       |
| `density`                | `"compact"` \| `"comfortable"` \| `"spacious"` | no       | —       | Controls body row padding density. Defaults to `'comfortable'`.                                                                                       |
| `rowHeight`              | `number`                                       | no       | —       | Fixed body-row pixel height used by row virtualization. Defaults to 44 when omitted or invalid.                                                       |
| `selectionMode`          | `"none"` \| `"single"` \| `"multiple"`         | no       | —       | Controls row-selection behavior. Cell focus and range selection remain available.                                                                     |
| `selectionModel`         | `string`[]                                     | no       | —       | Controlled row-selection ids, keyed by `getRowId`.                                                                                                    |
| `stickyHeader`           | `boolean`                                      | no       | —       | Keeps the column header row pinned to the top edge while scrolling. Defaults to `true`.                                                               |
| `virtualizeRows`         | `boolean`                                      | no       | —       | Enables fixed-height row virtualization. Columns still render fully.                                                                                  |
| `columnPinning`          | `(opaque)`                                     | no       | —       | Pins supplied column keys to the left or right edge. Not expressible in JSON Schema; see the component types for the signature.                       |
| `columns`                | `(opaque)`                                     | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                               |
| `getRowAriaLabel`        | `(opaque)`                                     | no       | —       | Optional accessible row label for screen-reader row summaries. Not expressible in JSON Schema; see the component types for the signature.             |
| `getRowId`               | `(opaque)`                                     | yes      | —       | Stable row identity used for ARIA ids and row-scoped state. Not expressible in JSON Schema; see the component types for the signature.                |
| `onSelectionModelChange` | `(opaque)`                                     | no       | —       | Called when row selection changes through cell interaction. Not expressible in JSON Schema; see the component types for the signature.                |
| `onSortModelChange`      | `(opaque)`                                     | no       | —       | Called after the user changes sort order and DataGrid updates `sortModel`. Not expressible in JSON Schema; see the component types for the signature. |
| `rowClass`               | `(opaque)`                                     | no       | —       | Additional class names for body rows. Not expressible in JSON Schema; see the component types for the signature.                                      |
| `rows`                   | `(opaque)`                                     | yes      | —       | A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                              |
| `sortModel`              | `(opaque)`                                     | no       | —       | Controls the row sort order used to render rows. Not expressible in JSON Schema; see the component types for the signature.                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
