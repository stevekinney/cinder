<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';

  import Tree from './tree/tree.svelte';
  import type { TreeSelectionBehavior, TreeSelectionMode } from './tree/tree.types.ts';

  let {
    'aria-label': ariaLabel,
    selectionMode,
    selectionBehavior,
    checkboxSelection = false,
    initialExpandedIds = [],
    initialSelectedIds = [],
    children,
  }: {
    'aria-label'?: string;
    selectionMode?: TreeSelectionMode;
    selectionBehavior?: TreeSelectionBehavior;
    checkboxSelection?: boolean;
    initialExpandedIds?: string[];
    initialSelectedIds?: string[];
    children: Snippet;
  } = $props();

  let expandedIds = $state<string[]>(untrack(() => initialExpandedIds));
  let selectedIds = $state<string[]>(untrack(() => initialSelectedIds));
</script>

<Tree
  aria-label={ariaLabel ?? 'Test tree'}
  selectionMode={selectionMode ?? 'none'}
  selectionBehavior={selectionBehavior ?? 'independent'}
  {checkboxSelection}
  bind:expandedIds
  bind:selectedIds
>
  {@render children()}
</Tree>
