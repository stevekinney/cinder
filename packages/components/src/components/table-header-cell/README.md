# TableHeaderCell

A TableHeaderCell component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import TableHeaderCell from 'cinder/table-header-cell';
</script>

<TableHeaderCell />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                    | Required | Default | Description                                                                                                                                                                                    |
| ---------- | ----------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                | no       | —       | Additional class names merged with `.cinder-table__header-cell`.                                                                                                                               |
| `column`   | `string`                | no       | —       | Column key. Required when `sortable=true` so the parent Table can track which column the user activated.                                                                                       |
| `scope`    | `"col"` \| `"colgroup"` | no       | —       | When set, hint to assistive tech that the column groups multiple rows.                                                                                                                         |
| `sortable` | `boolean`               | no       | —       | When true, render a button inside the `<th>` and dispatch sort intents to the parent Table. The cell's `aria-sort` reflects the current sort direction (`ascending`, `descending`, or `none`). |
| `children` | `(opaque)`              | —        | —       | function-or-snippet                                                                                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
