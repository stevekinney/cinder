# TableCell

Standard td cell within a table row for displaying a single data value.

## Usage

`TableCell` is a compose-only leaf of [`Table`](../table/README.md).
The idiomatic API is `Table.Cell`, reached through the parent
namespace — see the [table README](../table/README.md#usage) for the composed
snippet. The flat `cinder/table-cell` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type                                | Required | Default | Description                                                                                                                |
| ---------- | ----------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `align`    | `"left"` \| `"center"` \| `"right"` | no       | —       | Visual alignment for numeric columns.                                                                                      |
| `class`    | `string`                            | no       | —       | Additional class names merged with `.cinder-table__cell`.                                                                  |
| `children` | `(opaque)`                          | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
