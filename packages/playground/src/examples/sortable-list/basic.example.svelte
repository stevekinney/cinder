<script lang="ts" module>
  export const title = 'Basic sortable list';
  export const description = 'Keyboard and pointer reorderable list with announcer feedback.';
</script>

<script lang="ts">
  import { SortableList } from '@lostgradient/cinder/sortable-list';

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

  function getItemLabel(item: Task): string {
    return item.label;
  }

  function handleReorder(nextItems: Task[]) {
    items = nextItems;
  }
</script>

<SortableList {items} {getKey} {getItemLabel} onreorder={handleReorder} label="Task priority">
  {#snippet children(item)}
    <span style="padding: 0.5rem 0.75rem; display: block;">{item.label}</span>
  {/snippet}
</SortableList>
