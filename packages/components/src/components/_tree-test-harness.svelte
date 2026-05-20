<script lang="ts">
  import type { Snippet } from 'svelte';

  import Tree from './tree/tree.svelte';
  import type { TreeSelectionMode } from './tree/tree.types.ts';

  let {
    'aria-label': ariaLabel,
    selectionMode,
    initialExpandedIds = [],
    initialSelectedIds = [],
    children,
  }: {
    'aria-label'?: string;
    selectionMode?: TreeSelectionMode;
    initialExpandedIds?: string[];
    initialSelectedIds?: string[];
    children: Snippet;
  } = $props();

  let expandedIds = $state<string[]>(initialExpandedIds);
  let selectedIds = $state<string[]>(initialSelectedIds);
</script>

<Tree
  aria-label={ariaLabel ?? 'Test tree'}
  selectionMode={selectionMode ?? 'none'}
  bind:expandedIds
  bind:selectedIds
>
  {@render children()}
</Tree>
