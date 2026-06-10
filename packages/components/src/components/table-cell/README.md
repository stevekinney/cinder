# TableCell

Standard td cell within a table row for displaying a single data value.

## Usage

`TableCell` is a compose-only leaf of [`Table`](../table/README.md).
The idiomatic API is `Table.Cell`, reached through the parent
namespace — see the [table README](../table/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/table-cell` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type                                | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `align`    | `"left"` \| `"center"` \| `"right"` | no       | —       | Visual alignment for numeric columns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `as`       | `"td"` \| `"th"`                    | no       | —       | When `'th'`, renders a `<th scope="row">` instead of `<td>`, marking this cell as the row-header identifier for assistive technology. The component sets `scope="row"` itself (so `scope` is not part of the prop surface). Defaults to `'td'` so existing consumers are unaffected. The attribute surface is typed against `<td>` for both modes — `<td>` and `<th>` share `HTMLTableCellElement`, so this covers the common attributes. The `<th>`-only attributes (`colspan`, `rowspan`, `headers`, `abbr`) are not surfaced here; a discriminated `td`/`th` union was tried but produced a union TypeScript reports as "too complex to represent" against the full element attribute interfaces. Use the compositional Table family directly if a row-header cell needs those `<th>`-only attributes. |
| `class`    | `string`                            | no       | —       | Additional class names merged with `.cinder-table__cell`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `children` | `(opaque)`                          | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
