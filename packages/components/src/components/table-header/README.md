# TableHeader

A TableHeader component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import TableHeader from 'cinder/table-header';
</script>

<TableHeader />
```

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                                                                                                                                                                     |
| ---------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allSelected`    | `boolean`  | no       | —       | Checked state for the select-all checkbox. Required when `Table.selectable` is true.                                                                                                                                                                                            |
| `class`          | `string`   | no       | —       | Additional class names merged with `.cinder-table__header`.                                                                                                                                                                                                                     |
| `selectAllLabel` | `string`   | no       | —       | Accessible name for the select-all checkbox. Defaults to "Select all rows". When the table contains rows with `selectionDisabled={true}`, pass a more accurate label such as "Select all selectable rows".                                                                      |
| `someSelected`   | `boolean`  | no       | —       | When true and `allSelected` is false, the select-all checkbox renders as indeterminate. The browser exposes that as `aria-checked="mixed"` to assistive tech. Required (alongside `allSelected` and `onSelectAll`) when `Table.selectable` is true for accurate checkbox state. |
| `children`       | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                             |
| `onSelectAll`    | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
