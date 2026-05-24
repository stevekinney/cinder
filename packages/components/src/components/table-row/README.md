# TableRow

A TableRow component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`TableRow` is a compose-only leaf of [`Table`](../table/README.md).
The idiomatic API is `Table.Row`, reached through the parent
namespace — see the [table README](../table/README.md#usage) for the composed
snippet. The flat `cinder/table-row` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                              |
| ------------------- | ---------- | -------- | ------- | -------------------------------------------------------- |
| `class`             | `string`   | no       | —       | Additional class names merged with `.cinder-table__row`. |
| `selected`          | `boolean`  | no       | —       |                                                          |
| `selectionDisabled` | `boolean`  | no       | —       |                                                          |
| `selectionLabel`    | `string`   | no       | —       |                                                          |
| `children`          | `(opaque)` | —        | —       | function-or-snippet                                      |
| `onSelectedChange`  | `(opaque)` | —        | —       | function-or-snippet                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
