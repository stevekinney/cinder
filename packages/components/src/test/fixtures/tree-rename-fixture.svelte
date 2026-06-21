<script lang="ts">
  import { untrack } from 'svelte';
  import type { TreeSelectionMode } from '../../components/tree/tree.types.ts';
  import Tree from '../../components/tree/tree.svelte';
  import TreeItem from '../../components/tree-item/tree-item.svelte';

  let {
    initialLabel = 'Alpha',
    selectionMode = 'none',
    disabled = false,
    branch = false,
    includeBeta = true,
    onrename = async (_id: string, _nextLabel: string) => {},
  }: {
    initialLabel?: string;
    selectionMode?: TreeSelectionMode;
    disabled?: boolean;
    branch?: boolean;
    includeBeta?: boolean;
    onrename?: (itemId: string, nextLabel: string) => void | Promise<void>;
  } = $props();

  let label = $state(untrack(() => initialLabel));
  let expandedIds = $state<string[]>(untrack(() => (branch ? ['alpha'] : [])));

  async function handleRename(itemId: string, nextLabel: string): Promise<void> {
    await onrename(itemId, nextLabel);
    label = nextLabel;
  }
</script>

<Tree aria-label="Rename tree" {selectionMode} bind:expandedIds>
  {#key label}
    <TreeItem id="alpha" {label} {disabled} {branch} onrename={handleRename}>
      {#if branch}
        <TreeItem id="child" label="Child" />
      {/if}
    </TreeItem>
  {/key}

  {#if includeBeta}
    <TreeItem id="beta" label="Beta" />
  {/if}
</Tree>
