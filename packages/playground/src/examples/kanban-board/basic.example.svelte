<script lang="ts" module>
  export const title = 'Project board';
  export const description =
    'Move work items between columns, reorder columns, and collapse quiet lanes.';
  export const component = 'kanban-board';
</script>

<script lang="ts">
  import { Badge } from '@lostgradient/cinder/badge';
  import { KanbanBoard, type KanbanBoardColumn } from '@lostgradient/cinder/kanban-board';

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
  onchange={(nextColumns) => {
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
