<script lang="ts" module>
  export const title = 'Drag reorder';
  export const description =
    'Draggable tree items emit a consumer-owned reorder target. The example records the last drop so pointer behavior can be verified.';
</script>

<script lang="ts">
  import { Tree } from '@lostgradient/cinder/tree';

  type ReorderTarget = {
    id: string;
    position: 'before' | 'after' | 'child';
  };

  const items = [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta', branch: true },
    { id: 'gamma', label: 'Gamma' },
    { id: 'delta', label: 'Delta' },
    { id: 'epsilon', label: 'Epsilon' },
    { id: 'zeta', label: 'Zeta' },
  ];

  let lastDrop = $state('none');

  function handleReorder(draggedId: string, target: ReorderTarget): void {
    lastDrop = `${draggedId}:${target.position}:${target.id}`;
  }
</script>

<Tree
  class="reorder-tree"
  aria-label="Reorder files"
  onReorder={handleReorder}
  style="max-block-size: 7rem; overflow: auto; border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-md);"
>
  {#each items as item (item.id)}
    {#if item.branch}
      <Tree.Item id={item.id} label={item.label} branch draggable />
    {:else}
      <Tree.Item id={item.id} label={item.label} draggable />
    {/if}
  {/each}
</Tree>

<p data-testid="last-drop" style="margin-block-start: 0.75rem;">
  {lastDrop}
</p>
