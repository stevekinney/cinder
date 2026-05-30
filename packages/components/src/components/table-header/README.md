# TableHeader

A TableHeader component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`TableHeader` is a compose-only leaf of [`Table`](../table/README.md).
The idiomatic API is `Table.Header`, reached through the parent
namespace — see the [table README](../table/README.md#usage) for the composed
snippet. The flat `cinder/table-header` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                                                                                                                                                                     |
| ---------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allSelected`    | `boolean`  | no       | —       | Checked state for the select-all checkbox. Required when `Table.selectable` is true.                                                                                                                                                                                            |
| `class`          | `string`   | no       | —       | Additional class names merged with `.cinder-table__header`.                                                                                                                                                                                                                     |
| `selectAllLabel` | `string`   | no       | —       | Accessible name for the select-all checkbox. Defaults to "Select all rows". When the table contains rows with `selectionDisabled={true}`, pass a more accurate label such as "Select all selectable rows".                                                                      |
| `someSelected`   | `boolean`  | no       | —       | When true and `allSelected` is false, the select-all checkbox renders as indeterminate. The browser exposes that as `aria-checked="mixed"` to assistive tech. Required (alongside `allSelected` and `onSelectAll`) when `Table.selectable` is true for accurate checkbox state. |
| `children`       | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                      |
| `onSelectAll`    | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
