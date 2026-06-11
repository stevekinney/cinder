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

| Prop       | Type                                | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `align`    | `"left"` \| `"center"` \| `"right"` | no       | —       | Visual alignment for numeric columns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `as`       | `"td"` \| `"th"`                    | no       | —       | When `'th'`, renders a `<th scope="row">` instead of `<td>`, marking this cell as the row-header identifier for assistive technology. The component sets `scope="row"` itself (so `scope` is not part of the prop surface). Defaults to `'td'` so existing consumers are unaffected. The attribute surface is `HTMLTdAttributes` for both modes — `<td>` and `<th>` share `HTMLTableCellElement`, so `colspan`, `rowspan`, `headers`, and `abbr` are all forwarded regardless of `as`. Only `scope` is removed from the prop surface, because the component owns it (`scope="row"` when `as='th'`). |
| `class`    | `string`                            | no       | —       | Additional class names merged with `.cinder-table__cell`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `children` | `(opaque)`                          | no       | —       | Cell content. Optional so that empty `<td>` cells (used in spanning table layouts) are a valid, non-throwing state. When omitted the cell renders empty, which is valid HTML for a `<td>`. **Note for TypeScript consumers:** the Snippet type is never called externally by consuming code — Svelte's compiler handles invocation internally. Making this optional is therefore safe as an API change: no external caller calls `props.children()` on a Svelte component's props. Not expressible in JSON Schema; see the component types for the signature.                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
