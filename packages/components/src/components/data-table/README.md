# DataTable

Data-driven accessible table that renders rows and columns into a real <table> with <caption>, scoped column and row headers, optional sortable columns, and a horizontal-scroll responsive container.

## Usage

```svelte
<script lang="ts">
  import { DataTable } from '@lostgradient/cinder/data-table';

  const columns = [
    { key: 'name', label: 'Name', rowHeader: true },
    { key: 'score', label: 'Score', sortable: true, align: 'end' },
  ];
  const rows = [
    { name: 'Ada', score: 98 },
    { name: 'Grace', score: 95 },
  ];
</script>

<DataTable {columns} {rows} caption="Class roster" />
```

## Guidance

### Use When

- Rendering a roster, cohort, or assignment view from row/column data with real table semantics.
- Needing sortable columns with screen-reader-announced sort state out of the box.

### Avoid When

- Composing a bespoke table layout with custom cell markup — use the compositional Table family directly.
- Visualizing dense numeric magnitude across two dimensions — use matrix-chart instead.

## Props

<!-- generated:props:start -->

| Prop           | Type                                             | Required | Default | Description                                                                                                                     |
| -------------- | ------------------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `caption`      | `string`                                         | no       | —       | Visual caption rendered as a `<caption>` element above the table.                                                               |
| `class`        | `string`                                         | no       | —       | Additional class names merged onto the root `<table>` element.                                                                  |
| `density`      | `"comfortable"` \| `"condensed"` \| `"spacious"` | no       | —       | Vertical padding density for header and body cells. Defaults to `'comfortable'`.                                                |
| `scrollable`   | `boolean`                                        | no       | —       | When true, wraps the table in a `.cinder-table-scroll` container that enables horizontal overflow scrolling on small viewports. |
| `stickyHeader` | `boolean`                                        | no       | —       | When true, the header sticks to the top of the scrolling container.                                                             |
| `columns`      | `(opaque)`                                       | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                         |
| `rows`         | `(opaque)`                                       | no       | —       | A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.        |
| `sort`         | `(opaque)`                                       | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
