# Table

Full data table with header, body, and optional footer for structured tabular content.

## Usage

`Table` is a compound component. Import the parent and compose its leaves via
the namespace API: `Table.Header`, `Table.HeaderCell`, `Table.Body`,
`Table.Row`, and `Table.Cell`.

```svelte
<script lang="ts">
  import { Table } from '@lostgradient/cinder/table';

  const people = [
    { name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
    { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
  ];
</script>

<Table scrollable caption="Recent contributors">
  <Table.Header>
    <Table.Row>
      <Table.HeaderCell>Name</Table.HeaderCell>
      <Table.HeaderCell>Role</Table.HeaderCell>
      <Table.HeaderCell align="right">Commits</Table.HeaderCell>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each people as person (person.name)}
      <Table.Row>
        <Table.Cell>{person.name}</Table.Cell>
        <Table.Cell>{person.role}</Table.Cell>
        <Table.Cell align="right">{person.commits}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table>
```

Pass `scrollable` for dense or unknown-width tables. The Table root stays a
native `<table>`; Cinder generates a focusable `.cinder-table-scroll` wrapper
that owns horizontal overflow when the available component width is too narrow.
Use `scrollContainerProps` to label, style, or override attributes on that
generated wrapper. When `scrollable` and `stickyHeader` are combined, the
generated wrapper is the sticky header's scroll container; set a bounded block
size on `scrollContainerProps` when the table should scroll vertically inside
that wrapper.

The leaves remain importable individually for à-la-carte builds — see
`@lostgradient/cinder/table-body`, `@lostgradient/cinder/table-cell`, `@lostgradient/cinder/table-header`,
`@lostgradient/cinder/table-header-cell`, and `@lostgradient/cinder/table-row`.

## Props

<!-- generated:props:start -->

| Prop                   | Type                                             | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caption`              | `string`                                         | no       | —       | Visual caption rendered as a `<caption>` element.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `class`                | `string`                                         | no       | —       | Additional class names merged with `.cinder-table`.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `density`              | `"comfortable"` \| `"condensed"` \| `"spacious"` | no       | —       | Vertical padding density for header and body cells. Defaults to `'comfortable'`.                                                                                                                                                                                                                                                                                                                                                                              |
| `scrollable`           | `boolean`                                        | no       | —       | When true, wraps the table in a `.cinder-table-scroll` container that enables horizontal overflow scrolling for dense or unknown-width tables. Use this instead of manually wrapping Table in `.cinder-table-scroll`. When combined with `stickyHeader`, the generated wrapper is the sticky header's scroll container. Set a bounded block size on `scrollContainerProps` when the table should scroll vertically inside that wrapper.                       |
| `selectable`           | `boolean`                                        | no       | —       | Enables the leading selection column on the entire table. When true: - The single `TableRow` inside `TableHeader` renders a leading `<th>` with a select-all checkbox sourced from the header's props. - Every `TableRow` inside `TableBody` renders a leading selection cell. Selection is strictly controlled — the consumer owns all selection state.                                                                                                      |
| `stickyHeader`         | `boolean`                                        | no       | —       | When true, the header sticks to the top of the scrolling container.                                                                                                                                                                                                                                                                                                                                                                                           |
| `children`             | `(opaque)`                                       | yes      | —       | TableHeader, TableBody, etc. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                       |
| `scrollContainerProps` | `(opaque)`                                       | no       | —       | Attributes forwarded to the generated `.cinder-table-scroll` wrapper when `scrollable` is true. The wrapper is focusable by default so keyboard users can scroll read-only wide tables. When the table has a caption, or when `aria-label` or `aria-labelledby` is provided here, the wrapper becomes a named `region`; pass `role` or `tabindex` here to override those defaults. Not expressible in JSON Schema; see the component types for the signature. |
| `sort`                 | `(opaque)`                                       | no       | —       | Bound sort state. When the user activates a sortable header, this prop is updated to reflect the new column / direction. Pass `undefined` initially when no column is sorted; the component will never write back `undefined` itself (sort always toggles to a column). Not expressible in JSON Schema; see the component types for the signature.                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Table.Header` — the `<thead>` row group; see [`table-header`](../table-header/README.md).
- `Table.HeaderCell` — a sortable `<th>`; see
  [`table-header-cell`](../table-header-cell/README.md).
- `Table.Body` — the `<tbody>` row group; see [`table-body`](../table-body/README.md).
- `Table.Row` — a `<tr>` with optional selection; see [`table-row`](../table-row/README.md).
- `Table.Cell` — a `<td>` with optional alignment; see [`table-cell`](../table-cell/README.md).

<!-- generated:subcomponents:end -->
