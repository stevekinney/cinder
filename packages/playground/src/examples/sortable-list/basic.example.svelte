<script lang="ts" module>
  export const title = 'Basic sortable list';
  export const description = 'Keyboard and pointer reorderable list with announcer feedback.';
</script>

<script lang="ts">
  import { SortableList } from '@lostgradient/cinder/sortable-list';
  import type { SortableListProps } from '@lostgradient/cinder/sortable-list';

  type Task = { id: string; label: string };

  let items = $state<Task[]>([
    { id: 'task-1', label: 'Write release notes' },
    { id: 'task-2', label: 'Review pull requests' },
    { id: 'task-3', label: 'Update dependencies' },
    { id: 'task-4', label: 'Deploy to staging' },
  ]);

  function getKey(item: Task): string {
    return item.id;
  }

  function getItemLabel(item: Task, _originalIndex: number): string {
    return item.label;
  }

  // `onreorder` receives the reordered items AND a `change` descriptor (from/to
  // indices, moved key). This example only needs the new order, but the full
  // signature is shown so the canonical call shape is accurate.
  const handleReorder: SortableListProps<Task>['onreorder'] = (nextItems, _change) => {
    items = nextItems;
  };
</script>

<SortableList {items} {getKey} {getItemLabel} onreorder={handleReorder} label="Task priority">
  {#snippet children(item, _context)}
    <span style="padding: 0.5rem 0.75rem; display: block;">{item.label}</span>
  {/snippet}
</SortableList>
