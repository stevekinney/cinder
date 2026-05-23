<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Context control for selecting or clearing a Tree level in checkbox multi-selection mode.
   * @tag tree
   * @tag selection
   * @useWhen Adding select-all and select-none controls to a Tree selectionControls snippet.
   * @useWhen Selecting a registered tree level without placing non-treeitem controls inside role="tree".
   * @avoidWhen Rendering outside a Tree component — it requires Tree selectionControls context.
   * @avoidWhen Selecting arbitrary data that is not represented by registered tree items or selectionScopeIds.
   * @related tree, tree-item
   */
  export type { TreeSelectAllProps } from './tree-select-all.types.ts';
</script>

<script lang="ts">
  import { getContext } from 'svelte';

  import type { TreeContext } from '../../_internal/tree-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { TREE_CONTEXT_KEY } from '../tree/tree.svelte';
  import type { TreeSelectAllProps } from './tree-select-all.types.ts';

  let {
    parentId = null,
    includeDescendants = false,
    label = 'Tree selection',
    selectAllLabel = 'Select all',
    selectNoneLabel = 'Select none',
    class: className,
  }: TreeSelectAllProps = $props();

  const treeContext = getContext<TreeContext | undefined>(TREE_CONTEXT_KEY);
  if (!treeContext) {
    throw new Error('TreeSelectAll must be rendered from a Tree selectionControls snippet.');
  }
  const context = treeContext;

  const targetIds = $derived(context.selectionTargetsForChildren(parentId, includeDescendants));
  const disabled = $derived(!context.multiselectable || targetIds.length === 0);

  function selectAll(): void {
    if (!disabled) context.selectSelectionScope(parentId, true, includeDescendants);
  }

  function selectNone(): void {
    if (!disabled) context.selectSelectionScope(parentId, false, includeDescendants);
  }
</script>

<div class={classNames('cinder-tree-select-all', className)}>
  <span class="cinder-tree-select-all__label">{label}</span>
  <button type="button" class="cinder-tree-select-all__button" {disabled} onclick={selectAll}>
    {selectAllLabel}
  </button>
  <button type="button" class="cinder-tree-select-all__button" {disabled} onclick={selectNone}>
    {selectNoneLabel}
  </button>
</div>
