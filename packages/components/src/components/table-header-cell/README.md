# TableHeaderCell

th cell within a table header row, supporting sort indicators and column labels.

## Usage

`TableHeaderCell` is a compose-only leaf of [`Table`](../table/README.md).
The idiomatic API is `Table.HeaderCell`, reached through the parent
namespace — see the [table README](../table/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/table-header-cell` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type                                | Required | Default  | Description                                                                                                                                                                                    |
| ---------- | ----------------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `align`    | `"left"` \| `"center"` \| `"right"` | no       | `"left"` | Horizontal alignment for the header cell content. Defaults to `'left'`.                                                                                                                        |
| `class`    | `string`                            | no       | —        | Additional class names merged with `.cinder-table__header-cell`.                                                                                                                               |
| `column`   | `string`                            | no       | —        | Column key. Required when `sortable=true` so the parent Table can track which column the user activated.                                                                                       |
| `scope`    | `"col"` \| `"colgroup"`             | no       | `"col"`  | When set, hint to assistive tech that the column groups multiple rows.                                                                                                                         |
| `sortable` | `boolean`                           | no       | `false`  | When true, render a button inside the `<th>` and dispatch sort intents to the parent Table. The cell's `aria-sort` reflects the current sort direction (`ascending`, `descending`, or `none`). |
| `actions`  | `(opaque)`                          | no       | —        | Optional controls rendered beside, but outside, the sortable button. Not expressible in JSON Schema; see the component types for the signature.                                                |
| `children` | `(opaque)`                          | yes      | —        | Cell content (column label). Not expressible in JSON Schema; see the component types for the signature.                                                                                        |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
