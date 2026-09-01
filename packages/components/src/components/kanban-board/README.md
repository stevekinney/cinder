# KanbanBoard

Controlled multi-column board for reordering cards within and across workflow columns with keyboard, pointer, and live-region feedback.

## Usage

```svelte
<script lang="ts">
  import Badge from '@lostgradient/cinder/badge';
  import KanbanBoard from '@lostgradient/cinder/kanban-board';
  import type { KanbanBoardColumn } from '@lostgradient/cinder/kanban-board';

  type WorkItem = {
    id: string;
    title: string;
    owner: string;
    priority: 'Low' | 'Medium' | 'High';
  };

  let columns = $state<KanbanBoardColumn<WorkItem>[]>([
    {
      id: 'backlog',
      title: 'Backlog',
      cards: [
        { id: 'inventory-alerts', title: 'Inventory alerts', owner: 'Mina', priority: 'High' },
        { id: 'weekly-report', title: 'Weekly report export', owner: 'Dev', priority: 'Medium' },
      ],
    },
    {
      id: 'active',
      title: 'Active',
      cards: [
        { id: 'shipment-map', title: 'Shipment map filters', owner: 'Rae', priority: 'High' },
        { id: 'cycle-count', title: 'Cycle count cleanup', owner: 'Alex', priority: 'Low' },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [
        { id: 'store-pulse', title: 'Store pulse summary', owner: 'Nia', priority: 'Medium' },
      ],
    },
  ]);
</script>

<KanbanBoard
  label="Project work board"
  {columns}
  getCardKey={(item) => item.id}
  getCardLabel={(item) => item.title}
  collapsible
  onColumnsChange={(nextColumns) => {
    columns = nextColumns;
  }}
>
  {#snippet card(item)}
    <strong>{item.title}</strong>
    <span>{item.owner}</span>
    <Badge
      variant={item.priority === 'High'
        ? 'danger'
        : item.priority === 'Medium'
          ? 'warning'
          : 'neutral'}
    >
      {item.priority}
    </Badge>
  {/snippet}

  {#snippet emptyColumn(column)}
    Drop cards into {column.title}
  {/snippet}
</KanbanBoard>
```

## Guidance

### Use When

- Presenting a workflow board where users move cards between ordered columns.
- Consumers own card rendering and need cinder to manage reorder affordances and change metadata.

### Avoid When

- Showing a single ordered list — use sortable-list instead.
- Sorting by computed fields rather than direct manual placement.

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                                                                                |
| ----------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`   | no       | —       | Additional class merged onto the `.cinder-kanban-board` root element.                                                      |
| `collapsible`     | `boolean`  | no       | `false` | When true, each column renders a collapse/expand button that toggles its card list.                                        |
| `label`           | `string`   | no       | —       | Accessible label applied to the board's `<section>` root via `aria-label`.                                                 |
| `reorderColumns`  | `boolean`  | no       | `true`  | When true (default), columns can be reordered by dragging or keyboard. Set to false to make column order fixed.            |
| `card`            | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `columnActions`   | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `columnHeader`    | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `columns`         | `(opaque)` | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `emptyColumn`     | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getCardKey`      | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getCardLabel`    | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onColumnsChange` | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
