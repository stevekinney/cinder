# Table

A Table component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`Table` is a compound component. Import the parent and compose its leaves via
the namespace API: `Table.Header`, `Table.HeaderCell`, `Table.Body`,
`Table.Row`, and `Table.Cell`.

```svelte
<script lang="ts">
  import { Table } from 'cinder/table';

  const people = [
    { name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
    { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
  ];
</script>

<Table caption="Recent contributors">
  <Table.Header>
    <Table.Row>
      <Table.HeaderCell>Name</Table.HeaderCell>
      <Table.HeaderCell>Role</Table.HeaderCell>
      <Table.HeaderCell>Commits</Table.HeaderCell>
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

The leaves remain importable individually for à-la-carte builds — see
`cinder/table-body`, `cinder/table-cell`, `cinder/table-header`,
`cinder/table-header-cell`, and `cinder/table-row`.

## Props

<!-- generated:props:start -->

| Prop           | Type                                             | Required | Default | Description                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caption`      | `string`                                         | no       | —       | Visual caption rendered as a `<caption>` element.                                                                                                                                                                                                                                                                                                        |
| `class`        | `string`                                         | no       | —       | Additional class names merged with `.cinder-table`.                                                                                                                                                                                                                                                                                                      |
| `density`      | `"comfortable"` \| `"condensed"` \| `"spacious"` | no       | —       | Vertical padding density for header and body cells. Defaults to `'comfortable'`.                                                                                                                                                                                                                                                                         |
| `selectable`   | `boolean`                                        | no       | —       | Enables the leading selection column on the entire table. When true: - The single `TableRow` inside `TableHeader` renders a leading `<th>` with a select-all checkbox sourced from the header's props. - Every `TableRow` inside `TableBody` renders a leading selection cell. Selection is strictly controlled — the consumer owns all selection state. |
| `stickyHeader` | `boolean`                                        | no       | —       | When true, the header sticks to the top of the scrolling container.                                                                                                                                                                                                                                                                                      |
| `children`     | `(opaque)`                                       | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                      |
| `sort`         | `(opaque)`                                       | —        | —       | unknown-shape                                                                                                                                                                                                                                                                                                                                            |

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
