# Table

A Table component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Table from 'cinder/table';
</script>

<Table />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                                             | Required | Default | Description                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caption`      | `string`                                                         | no       | —       | Visual caption rendered as a `<caption>` element.                                                                                                                                                                                                                                                                                                        |
| `class`        | `string`                                                         | no       | —       | Additional class names merged with `.cinder-table`.                                                                                                                                                                                                                                                                                                      |
| `density`      | `"comfortable"` \| `"condensed"` \| `"spacious"`                 | no       | —       | Vertical padding density for header and body cells. Defaults to `'comfortable'`.                                                                                                                                                                                                                                                                         |
| `selectable`   | `boolean`                                                        | no       | —       | Enables the leading selection column on the entire table. When true: - The single `TableRow` inside `TableHeader` renders a leading `<th>` with a select-all checkbox sourced from the header's props. - Every `TableRow` inside `TableBody` renders a leading selection cell. Selection is strictly controlled — the consumer owns all selection state. |
| `sort`         | { column: `string`; direction: `"ascending"` \| `"descending"` } | no       | —       | Bound sort state. When the user activates a sortable header, this prop is updated to reflect the new column / direction. Pass `undefined` initially when no column is sorted; the component will never write back `undefined` itself (sort always toggles to a column).                                                                                  |
| `stickyHeader` | `boolean`                                                        | no       | —       | When true, the header sticks to the top of the scrolling container.                                                                                                                                                                                                                                                                                      |
| `children`     | `(opaque)`                                                       | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
