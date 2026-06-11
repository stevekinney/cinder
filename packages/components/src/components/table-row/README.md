# TableRow

`tr` wrapper that groups a set of cells into a single table row.

## Usage

`TableRow` is a compose-only leaf of [`Table`](../table/README.md).
The idiomatic API is `Table.Row`, reached through the parent
namespace — see the [table README](../table/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/table-row` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                                                                        |
| ------------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`   | no       | —       | Additional class names merged with `.cinder-table__row`.                                                                                                                                                                                                                           |
| `selected`          | `boolean`  | no       | —       |                                                                                                                                                                                                                                                                                    |
| `selectionDisabled` | `boolean`  | no       | —       |                                                                                                                                                                                                                                                                                    |
| `selectionLabel`    | `string`   | no       | —       | Accessible name for the disabled selection checkbox. Provide a localised string to override the English default ("Selection not allowed for this row"). The library cannot localise on the consumer's behalf, so this is the seam for non-English applications or custom phrasing. |
| `children`          | `(opaque)` | yes      | —       | Cell children (TableCell or TableHeaderCell). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                           |
| `onSelectedChange`  | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
