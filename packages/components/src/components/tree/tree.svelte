<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Composite root that renders a hierarchical tree of tree-item nodes with keyboard navigation and selection state.
   * @tag tree
   * @tag hierarchy
   * @useWhen Presenting hierarchical data such as a file system, organization, or nested categories.
   * @useWhen Coordinating single- or multi-select state across all descendant tree-items via the selectionMode prop.
   * @avoidWhen Disclosing flat sibling sections — use accordion instead.
   * @avoidWhen Switching between sibling views of the same region — use tabs instead.
   * @related tree-item, accordion
   */
  export type {
    TreeFilterPredicate,
    TreeProps,
    TreeRef,
    TreeSelectionBehavior,
    TreeSelectionMode,
    TreeVirtualizedItemRenderState,
  } from './tree.types.ts';
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { TreeProps, TreeRef } from './tree.types.ts';

  import type { TreeContext } from '../../_internal/tree-context.ts';
  import { setTreeContext, setTreeItemParentContext } from '../../_internal/tree-context.ts';
  import {
    descendantTreeDataIds,
    flattenTreeDataItems,
    visibleTreeDataItems,
    type FlattenedTreeDataItem,
  } from '../../_internal/tree-data.ts';
  import { TreeDragController } from '../../_internal/tree-drag-controller.svelte.ts';
  import type { TreeVisibilityPredicate } from '../../_internal/tree-registry.svelte.ts';
  import { TreeRegistry } from '../../_internal/tree-registry.svelte.ts';
  import { TreeVirtualizer } from '../../_internal/use-virtualizer.svelte.ts';
  import type { VirtualItem } from '../../_internal/virtual-item.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import {
    deselectIds,
    selectIds,
    selectionStateFor,
    toggleIndependentId,
    toggleSelectionScope,
  } from './tree-selection.ts';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    selectionMode = 'none',
    checkboxSelection = false,
    selectionBehavior = 'independent',
    selectedIds = $bindable([]),
    expandedIds = $bindable([]),
    ref = $bindable<TreeRef | undefined>(),
    items,
    virtualized = false,
    virtualizationEstimatedRowHeight = 36,
    virtualizationOverscan = 4,
    virtualizationHeight = '20rem',
    virtualizedItem,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    disableTypeahead = false,
    id: idAttribute,
    class: className,
    style: styleAttribute,
    selectionControls,
    filterValue,
    onFilterChange,
    filterPlaceholder = 'Search tree',
    showSearch = false,
    filterPredicate = defaultFilterPredicate,
    onReorder,
    children,
    ...rest
  }: TreeProps = $props();

  const generatedId = $props.id();

  function normalizeOptionalText(value: string | undefined): string | undefined {
    const trimmedValue = value?.trim();
    return trimmedValue ? trimmedValue : undefined;
  }

  function defaultFilterPredicate(label: string, _id: string, query: string): boolean {
    return label.toLowerCase().includes(query.toLowerCase());
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const registry = new TreeRegistry();
  let focusedId = $state<string | null>(null);
  let treeElement = $state<HTMLElement | null>(null);
  let filterInputElement = $state<HTMLInputElement | null>(null);
  let uncontrolledFilterValue = $state(untrack(() => filterValue ?? ''));
  let filterStatusAnnouncement = $state('');
  let filterStatusAnnouncementSequence = $state(0);
  let filterStatusBusy = $state(false);
  let filterStatusTimer: ReturnType<typeof setTimeout> | null = null;
  let expansionAnnouncement = $state('');
  let expansionAnnouncementSequence = $state(0);
  let dragAnnouncement = $state('');
  let dragAnnouncementSequence = $state(0);
  let dragController: TreeDragController | null = $state(null);
  let latestDragPointerX = 0;
  let latestDragPointerY = 0;
  let dragScrollElement: HTMLElement | null = null;
  let dragScrollAnimationFrame: number | null = null;

  // Anchor for shift-select range
  let selectionAnchorId = $state<string | null>(null);

  // Typeahead buffer
  let typeaheadBuffer = $state('');
  let typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

  // Warn once when no accessible label is provided
  let hasWarnedNoLabel = false;
  let hasWarnedVirtualizedChildren = false;
  let hasWarnedVirtualizedWithoutItems = false;

  const resolvedAriaLabel = $derived(normalizeOptionalText(ariaLabel));
  const resolvedAriaLabelledBy = $derived(normalizeOptionalText(ariaLabelledBy));
  const resolvedFilterPlaceholder = $derived(
    normalizeOptionalText(filterPlaceholder) ?? 'Search tree',
  );

  $effect(() => {
    if (!resolvedAriaLabel && !resolvedAriaLabelledBy && !hasWarnedNoLabel) {
      hasWarnedNoLabel = true;
      devWarn('[cinder-tree] Tree requires either aria-label or aria-labelledby.');
    }
  });

  $effect(() => {
    if (virtualized && children && !hasWarnedVirtualizedChildren) {
      hasWarnedVirtualizedChildren = true;
      devWarn(
        '[cinder-tree] virtualized Tree uses the items prop; child snippets are ignored while virtualized is true.',
      );
    }

    if (virtualized && !items && !hasWarnedVirtualizedWithoutItems) {
      hasWarnedVirtualizedWithoutItems = true;
      devWarn('[cinder-tree] virtualized Tree requires the items prop.');
    }
  });

  // Clear typeahead timer on unmount
  $effect(() => {
    return () => {
      if (typeaheadTimer !== null) {
        clearTimeout(typeaheadTimer);
        typeaheadTimer = null;
      }
      if (filterStatusTimer !== null) {
        clearTimeout(filterStatusTimer);
        filterStatusTimer = null;
      }
      stopDragAutoscroll();
    };
  });

  // ---------------------------------------------------------------------------
  // Derived visible list
  // ---------------------------------------------------------------------------

  const isFilterControlled = $derived(filterValue !== undefined);
  const currentFilterValue = $derived(
    isFilterControlled ? (filterValue ?? '') : uncontrolledFilterValue,
  );
  const normalizedFilterValue = $derived(currentFilterValue.trim());
  const filtering = $derived(normalizedFilterValue.length > 0);
  const treeId = $derived(idAttribute ?? `${generatedId}-tree`);
  const filterInputId = $derived(`${generatedId}-filter`);
  const dragInstructionsId = $derived(`${generatedId}-drag-instructions`);
  const isVirtualizedTree = $derived(virtualized && items != null);
  const flattenedDataItems = $derived.by(() => flattenTreeDataItems(items ?? []));
  const flattenedDataItemById = $derived.by(
    () => new Map(flattenedDataItems.map((item) => [item.id, item])),
  );
  const hasTreeChrome = $derived(
    selectionControls != null || showSearch || filtering || onReorder != null,
  );
  const hasRegisteredItems = $derived(
    isVirtualizedTree ? flattenedDataItems.length > 0 : registry.size > 0,
  );
  const activeVisibilityPredicate = $derived.by<TreeVisibilityPredicate | undefined>(() => {
    if (!filtering) return undefined;
    const query = normalizedFilterValue;
    const predicate = filterPredicate;
    return ({ id, label }) => predicate(label, id, query);
  });
  const activeDataVisibilityPredicate = $derived.by<
    ((item: FlattenedTreeDataItem) => boolean) | undefined
  >(() => {
    if (!filtering) return undefined;
    const query = normalizedFilterValue;
    const predicate = filterPredicate;
    return (item) => predicate(item.label, item.id, query);
  });
  const visibleDataItems = $derived.by(() =>
    visibleTreeDataItems(flattenedDataItems, expandedIds, activeDataVisibilityPredicate),
  );
  const registryVisibleIds = $derived.by(() =>
    registry.getVisible(expandedIds, activeVisibilityPredicate),
  );
  const visibleIds = $derived.by(() =>
    isVirtualizedTree ? visibleDataItems.map((item) => item.id) : registryVisibleIds,
  );
  const hasNoFilterResults = $derived(filtering && hasRegisteredItems && visibleIds.length === 0);
  const visibleIdSet = $derived.by(() => new SvelteSet(visibleIds));
  const expandableBranchIds = $derived.by(() =>
    isVirtualizedTree
      ? flattenedDataItems.filter((item) => item.branch).map((item) => item.id)
      : registry.getAllBranchIds({ bulkOnly: true }),
  );
  const expandableBranchCount = $derived(expandableBranchIds.length);
  const hasExpandedItems = $derived(expandedIds.length > 0);

  $effect(() => {
    if (filterStatusTimer !== null) {
      clearTimeout(filterStatusTimer);
      filterStatusTimer = null;
    }

    if (!filtering) {
      filterStatusBusy = false;
      filterStatusAnnouncement = '';
      return;
    }

    const query = normalizedFilterValue;
    const resultCount = visibleIds.length;
    filterStatusBusy = true;
    filterStatusTimer = setTimeout(() => {
      filterStatusAnnouncement =
        resultCount === 0
          ? `No results for ${query}.`
          : `${resultCount} result${resultCount === 1 ? '' : 's'} found.`;
      filterStatusAnnouncementSequence += 1;
      filterStatusBusy = false;
      filterStatusTimer = null;
    }, 500);
  });

  // Initial roving tabindex: first selected visible item, or first visible item
  const initialFocusId = $derived.by(() => {
    if (selectionMode !== 'none' && selectedIds.length > 0) {
      for (const id of visibleIds) {
        if (selectedIds.includes(id)) return id;
      }
    }
    return visibleIds[0] ?? null;
  });

  function visibleFocusCandidate(id: string | null): string | null {
    return id !== null && visibleIds.includes(id) ? id : null;
  }

  // Validate both candidates against the current visible registry. initialFocusId
  // is derived from visibleIds, but keeping both paths explicit protects this
  // invariant if the fallback logic changes later.
  const effectiveFocusedId = $derived.by(() => {
    return (
      visibleFocusCandidate(focusedId) ??
      visibleFocusCandidate(initialFocusId) ??
      visibleIds[0] ??
      null
    );
  });

  $effect(() => {
    if (focusedId === null || visibleIds.includes(focusedId)) return;
    focusedId = initialFocusId ?? visibleIds[0] ?? null;
  });

  const virtualizer = new TreeVirtualizer({
    getScrollElement: () => treeElement,
    getCount: () => visibleDataItems.length,
    getItemKey: (index) => visibleDataItems[index]?.id ?? index,
    getEstimatedSize: () => virtualizationEstimatedRowHeight,
    getOverscan: () => virtualizationOverscan,
    getInitialHeight: () =>
      typeof virtualizationHeight === 'number'
        ? virtualizationHeight
        : virtualizationEstimatedRowHeight * 10,
  });

  $effect(() => {
    virtualizer.setScrollElement(isVirtualizedTree ? treeElement : null);
  });

  const virtualItems = $derived(virtualizer.virtualItems);
  const virtualizedActiveItem = $derived(
    effectiveFocusedId ? flattenedDataItemById.get(effectiveFocusedId) : undefined,
  );
  const virtualizedActiveDescendantId = $derived(
    isVirtualizedTree && virtualizedActiveItem
      ? virtualItemElementId(virtualizedActiveItem)
      : undefined,
  );
  const virtualRows = $derived.by(() => {
    const rows: { virtualItem: VirtualItem; item: FlattenedTreeDataItem }[] = [];
    const renderedIndexes = new Set<number>();

    for (const virtualItem of virtualItems) {
      const item = visibleDataItems[virtualItem.index];
      if (item) {
        renderedIndexes.add(virtualItem.index);
        rows.push({ virtualItem, item });
      }
    }

    if (effectiveFocusedId) {
      const focusedIndex = visibleIds.indexOf(effectiveFocusedId);
      const focusedItem = visibleDataItems[focusedIndex];
      if (focusedItem && !renderedIndexes.has(focusedIndex)) {
        const size = virtualizationEstimatedRowHeight;
        rows.push({
          item: focusedItem,
          virtualItem: {
            key: focusedItem.id,
            index: focusedIndex,
            start: focusedIndex * size,
            end: (focusedIndex + 1) * size,
            size,
            lane: 0,
          },
        });
      }
    }

    rows.sort((a, b) => a.virtualItem.index - b.virtualItem.index);
    return rows;
  });

  function virtualItemElementId(item: FlattenedTreeDataItem): string {
    return `${treeId}-item-${item.index}`;
  }

  function virtualizedHeightValue(): string {
    return typeof virtualizationHeight === 'number'
      ? `${virtualizationHeight}px`
      : virtualizationHeight;
  }

  function virtualizedTreeStyle(): string {
    return `block-size: ${virtualizedHeightValue()}; overflow: auto; position: relative;`;
  }

  function treeStyle(): string | undefined {
    const forwardedStyle = styleAttribute ?? undefined;
    if (!isVirtualizedTree) return forwardedStyle;
    return forwardedStyle ? `${forwardedStyle}; ${virtualizedTreeStyle()}` : virtualizedTreeStyle();
  }

  function virtualizedSpacerStyle(): string {
    return `block-size: ${virtualizer.totalSize}px; position: relative; inline-size: 100%;`;
  }

  function virtualizedRowStyle(start: number, size: number): string {
    return `position: absolute; inset-inline: 0; transform: translateY(${start}px); block-size: ${size}px;`;
  }

  function virtualizedItemExpanded(item: FlattenedTreeDataItem): boolean {
    return (
      expandedIds.includes(item.id) ||
      (filtering &&
        item.branch &&
        visibleDataItems.some(
          (visibleItem) => visibleItem.id !== item.id && visibleItem.ancestorIds.includes(item.id),
        ))
    );
  }

  function firstVisibleVirtualizedChildIndex(parentId: string): number {
    return visibleDataItems.findIndex((item) => item.parentId === parentId);
  }

  function focusFirstVirtualizedChild(parentId: string): void {
    const index = firstVisibleVirtualizedChildIndex(parentId);
    if (index !== -1) void focusVirtualIndex(index);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function focusNode(id: string): void {
    if (isVirtualizedTree) {
      const index = visibleIds.indexOf(id);
      if (index !== -1) void focusVirtualIndex(index);
      return;
    }

    focusedId = id;
    registry.getNode(id)?.focus();
  }

  async function focusVirtualIndex(index: number): Promise<void> {
    const id = visibleIds[index];
    if (!id) return;
    virtualizer.scrollToIndex(index, { align: 'auto' });
    await tick();
    focusedId = id;
    treeElement?.focus();
  }

  function announceExpansion(message: string): void {
    expansionAnnouncement = message;
    expansionAnnouncementSequence += 1;
  }

  function announceDrag(message: string): void {
    dragAnnouncement = message;
    dragAnnouncementSequence += 1;
  }

  $effect(() => {
    if (!onReorder) {
      dragController = null;
      return;
    }

    dragController ??= new TreeDragController(
      untrack(() => ({
        getVisibleIds: () => visibleIds,
        getNode: (id) => registry.getNode(id),
        getParentId: (id) => registry.parentOf(id),
        isBranch: (id) => registry.getNode(id)?.isBranch() ?? false,
        focus: focusNode,
        announce: announceDrag,
        commit: (draggedId, target) => onReorder?.(draggedId, target),
      })),
    );
  });

  function focusFallbackAfterUnregister(parentId: string | null): void {
    const currentVisibleIds = registry.getVisible(expandedIds, activeVisibilityPredicate);
    const selectedVisibleId =
      selectionMode === 'none' ? null : currentVisibleIds.find((id) => selectedIds.includes(id));
    const fallbackId =
      (parentId && currentVisibleIds.includes(parentId) ? parentId : null) ??
      selectedVisibleId ??
      currentVisibleIds[0] ??
      null;

    if (fallbackId) {
      focusNode(fallbackId);
    } else {
      focusedId = null;
    }
  }

  function setExpandedInternal(id: string, next: boolean): void {
    if (next) {
      if (!expandedIds.includes(id)) {
        expandedIds = [...expandedIds, id];
      }
    } else {
      expandedIds = expandedIds.filter((existing) => existing !== id);
    }
  }

  function withExpandedIds(ids: readonly string[]): string[] {
    const nextIds = [...expandedIds];
    const seen = new Set(nextIds);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        nextIds.push(id);
      }
    }
    return nextIds;
  }

  async function expandAll(): Promise<void> {
    if (isVirtualizedTree) {
      const nextIds = withExpandedIds(expandableBranchIds);
      if (nextIds.length !== expandedIds.length) {
        expandedIds = nextIds;
        await tick();
        announceExpansion('All items expanded.');
      }
      return;
    }

    let changed = false;

    while (true) {
      const nextIds = withExpandedIds(registry.getAllBranchIds({ bulkOnly: true }));
      if (nextIds.length === expandedIds.length) break;
      expandedIds = nextIds;
      changed = true;
      await tick();
    }

    if (changed) announceExpansion('All items expanded.');
  }

  function collapseAll(): void {
    if (expandedIds.length === 0) return;
    expandedIds = [];
    announceExpansion('All items collapsed.');
  }

  function expandOneLevel(): void {
    const expandedIdSet = new Set(expandedIds);
    const visibleBranchIds = isVirtualizedTree
      ? visibleDataItems
          .filter((item) => item.branch && item.ancestorIds.every((id) => expandedIdSet.has(id)))
          .map((item) => item.id)
      : visibleIds.filter(
          (id) =>
            registry.isBulkExpandableBranch(id) &&
            registry.ancestorsOf(id).every((ancestorId) => expandedIdSet.has(ancestorId)),
        );
    const nextIds = withExpandedIds(visibleBranchIds);
    if (nextIds.length === expandedIds.length) return;
    expandedIds = nextIds;
    announceExpansion('One tree level expanded.');
  }

  function focusItem(id: string): void {
    if (!visibleIds.includes(id)) return;
    focusNode(id);
  }

  async function expandToItem(id: string): Promise<void> {
    if (isVirtualizedTree) {
      const item = flattenedDataItemById.get(id);
      if (!item) return;
      const nextIds = withExpandedIds(item.ancestorIds);
      if (nextIds.length !== expandedIds.length) {
        expandedIds = nextIds;
        await tick();
      }
      focusItem(id);
      return;
    }

    if (!registry.getNode(id)) return;
    const nextIds = withExpandedIds(registry.ancestorsOf(id));
    if (nextIds.length !== expandedIds.length) {
      expandedIds = nextIds;
      await tick();
    }
    focusItem(id);
  }

  function scrollToRow(id: string, options?: ScrollIntoViewOptions): void {
    if (isVirtualizedTree) {
      const index = visibleIds.indexOf(id);
      if (index !== -1) {
        virtualizer.scrollToIndex(index, {
          align: options?.block === 'center' ? 'center' : 'auto',
          behavior: options?.behavior === 'smooth' ? 'smooth' : 'auto',
        });
      }
      return;
    }

    registry.getNode(id)?.node.scrollIntoView(options ?? { block: 'nearest' });
  }

  function disabledIdsFor(ids: readonly string[]): Set<string> {
    const disabledIds = new Set<string>();
    for (const id of ids) {
      if (isVirtualizedTree) {
        if (flattenedDataItemById.get(id)?.disabled) disabledIds.add(id);
      } else if (registry.getNode(id)?.disabled) {
        disabledIds.add(id);
      }
    }
    return disabledIds;
  }

  function checkboxSelectionActive(): boolean {
    return checkboxSelection && selectionMode === 'multiple';
  }

  function ariaCheckedForSelectionState(state: ReturnType<typeof selectionStateForId>) {
    if (!checkboxSelectionActive()) return undefined;
    if (state.indeterminate) return 'mixed';
    return state.checked ? 'true' : 'false';
  }

  function selectionTargetsFor(id: string): string[] {
    if (isVirtualizedTree) {
      const item = flattenedDataItemById.get(id);
      if (!item) return [];
      return [id, ...descendantTreeDataIds(flattenedDataItems, id)];
    }

    const node = registry.getNode(id);
    if (!node) return [];
    const explicitScopeIds = node.selectionScopeIds?.();
    if (explicitScopeIds?.length) return [...explicitScopeIds];
    return [id, ...registry.descendantsOf(id)];
  }

  function childDataItemIds(parentId: string | null): string[] {
    return visibleDataItems.filter((item) => item.parentId === parentId).map((item) => item.id);
  }

  function selectionTargetsForChildren(
    parentId: string | null,
    includeDescendants: boolean,
  ): string[] {
    const childIds = isVirtualizedTree ? childDataItemIds(parentId) : registry.childrenOf(parentId);
    if (!includeDescendants) return childIds;

    const targets: string[] = [];
    for (const childId of childIds) {
      targets.push(...selectionTargetsFor(childId));
    }
    return [...new Set(targets)];
  }

  function selectionStateForId(id: string) {
    const targets = selectionBehavior === 'cascade' ? selectionTargetsFor(id) : [id];
    const aggregateDisabledIds = disabledIdsFor(targets.filter((targetId) => targetId !== id));
    return selectionStateFor(selectedIds, targets, aggregateDisabledIds);
  }

  function applySelectionScope(
    targets: readonly string[],
    next: boolean | undefined = undefined,
  ): void {
    const disabledIds = disabledIdsFor(targets);
    selectedIds =
      next === true
        ? selectIds(selectedIds, targets, disabledIds)
        : next === false
          ? deselectIds(selectedIds, targets, disabledIds)
          : toggleSelectionScope(selectedIds, targets, disabledIds);
  }

  function toggleSelectionScopeInternal(id: string): void {
    if (selectionMode !== 'multiple') return;
    const disabled = isVirtualizedTree
      ? (flattenedDataItemById.get(id)?.disabled ?? true)
      : (registry.getNode(id)?.disabled ?? true);
    if (disabled) return;

    if (selectionBehavior === 'cascade') {
      applySelectionScope(selectionTargetsFor(id));
    } else {
      selectedIds = toggleIndependentId(selectedIds, id, disabledIdsFor([id]));
    }
    selectionAnchorId = id;
  }

  function toggleSelectedInternal(id: string, event: KeyboardEvent | MouseEvent | null): void {
    const disabled = isVirtualizedTree
      ? (flattenedDataItemById.get(id)?.disabled ?? true)
      : (registry.getNode(id)?.disabled ?? true);
    if (disabled) return;
    if (selectionMode === 'none') return;

    const isShift = event?.shiftKey ?? false;
    const isMeta = event ? event.metaKey || event.ctrlKey : false;

    if (selectionMode === 'single') {
      selectedIds = selectedIds.includes(id) ? [] : [id];
      selectionAnchorId = id;
      return;
    }

    // multiple
    if (isShift && selectionAnchorId) {
      // Reset anchor if it has become invisible
      const anchorVisible = visibleIds.includes(selectionAnchorId);
      const anchor = anchorVisible ? selectionAnchorId : id;
      if (!anchorVisible) selectionAnchorId = id;

      const anchorIndex = visibleIds.indexOf(anchor);
      const targetIndex = visibleIds.indexOf(id);
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangeIds = visibleIds.slice(start, end + 1).filter((rangeId) => {
        if (isVirtualizedTree) return !flattenedDataItemById.get(rangeId)?.disabled;
        const rangeNode = registry.getNode(rangeId);
        return rangeNode && !rangeNode.disabled;
      });
      selectedIds = rangeIds;
    } else if (isMeta) {
      // Ctrl/Cmd toggles individual
      selectedIds = toggleIndependentId(selectedIds, id);
      selectionAnchorId = id;
    } else {
      if (selectionBehavior === 'cascade') {
        applySelectionScope(selectionTargetsFor(id));
      } else {
        selectedIds = toggleIndependentId(selectedIds, id);
      }
      selectionAnchorId = id;
    }
  }

  function selectAll(): void {
    if (selectionMode !== 'multiple') return;
    const allVisibleTargets = visibleIds.flatMap((id) => {
      const disabled = isVirtualizedTree
        ? (flattenedDataItemById.get(id)?.disabled ?? true)
        : (registry.getNode(id)?.disabled ?? true);
      if (disabled) return [];
      return selectionBehavior === 'cascade' ? selectionTargetsFor(id) : [id];
    });
    const disabledIds = disabledIdsFor(allVisibleTargets);
    selectedIds = selectIds(
      selectionBehavior === 'cascade' ? selectedIds : [],
      allVisibleTargets,
      disabledIds,
    );
    // Guarded by length, so the first selected id is present.
    if (allVisibleTargets.length > 0) selectionAnchorId = allVisibleTargets[0]!;
  }

  const treeRef: TreeRef = {
    expandAll,
    collapseAll,
    expandOneLevel,
    focusItem,
    expandToItem,
    scrollToRow,
  };

  $effect(() => {
    ref = treeRef;
    return () => {
      ref = undefined;
    };
  });

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------

  const context: TreeContext = {
    get selectionMode() {
      return selectionMode;
    },
    get selectionBehavior() {
      return selectionBehavior;
    },
    get checkboxSelection() {
      return checkboxSelection;
    },
    get multiselectable() {
      return selectionMode === 'multiple';
    },
    get typeaheadEnabled() {
      return !disableTypeahead;
    },
    get expandedIds() {
      return expandedIds;
    },
    get selectedIds() {
      return selectedIds;
    },
    get focusedId() {
      return effectiveFocusedId;
    },
    get filtering() {
      return filtering;
    },
    get filterValue() {
      return normalizedFilterValue;
    },
    get hasRegisteredItems() {
      return hasRegisteredItems;
    },
    get expandableBranchCount() {
      return expandableBranchCount;
    },
    get hasExpandedItems() {
      return hasExpandedItems;
    },
    get dragController() {
      return dragController;
    },
    get dragInstructionsId() {
      return dragInstructionsId;
    },
    isExpanded(id) {
      return expandedIds.includes(id);
    },
    isSelected(id) {
      return selectedIds.includes(id);
    },
    isFocused(id) {
      return effectiveFocusedId === id;
    },
    isVisible(id) {
      return visibleIdSet.has(id);
    },
    hasVisibleDescendant(id) {
      return registry.descendantsOf(id).some((descendantId) => visibleIdSet.has(descendantId));
    },
    matchesFilter(label, id) {
      return filtering && filterPredicate(label, id, normalizedFilterValue);
    },
    checkboxSelectionActive,
    selectionStateFor: selectionStateForId,
    toggleSelectionScope(id) {
      toggleSelectionScopeInternal(id);
    },
    selectSelectionScope(parentId, next, includeDescendants) {
      if (selectionMode !== 'multiple') return;
      applySelectionScope(selectionTargetsForChildren(parentId, includeDescendants), next);
    },
    hasSelectableSelectionScope(parentId, includeDescendants) {
      const targets = selectionTargetsForChildren(parentId, includeDescendants);
      const disabledIds = disabledIdsFor(targets);
      return targets.some((id) => !disabledIds.has(id));
    },
    selectionTargetsFor,
    selectionTargetsForChildren,
    setExpanded: setExpandedInternal,
    expandAll,
    collapseAll,
    expandOneLevel,
    focusItem,
    expandToItem,
    scrollToRow,
    toggleSelected: toggleSelectedInternal,
    register(node) {
      const unregister = registry.register(node);
      return () => {
        unregister();
        if (focusedId === node.id) {
          focusFallbackAfterUnregister(node.parentId);
        }
      };
    },
    focusVisibleDelta(currentId, delta) {
      const index = visibleIds.indexOf(currentId);
      if (index === -1) return;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= visibleIds.length) return;
      // Bounds checks above prove the requested visible id exists.
      focusNode(visibleIds[nextIndex]!);
    },
    canFocusVisibleDelta(currentId, delta) {
      const index = visibleIds.indexOf(currentId);
      if (index === -1) return false;
      const nextIndex = index + delta;
      return nextIndex >= 0 && nextIndex < visibleIds.length;
    },
    focusFirstVisible() {
      // Length check proves the first visible id exists.
      if (visibleIds.length > 0) focusNode(visibleIds[0]!);
    },
    focusLastVisible() {
      // Length check proves the last visible id exists.
      if (visibleIds.length > 0) focusNode(visibleIds[visibleIds.length - 1]!);
    },
    focusParent(currentId) {
      const parentId = registry.parentOf(currentId);
      if (parentId) focusNode(parentId);
    },
    focusFirstChild(currentId) {
      const childId = registry.childrenOf(currentId).find((id) => visibleIdSet.has(id));
      if (childId) focusNode(childId);
    },
    handleTypeahead(char, currentId) {
      if (disableTypeahead) return;

      if (typeaheadTimer !== null) clearTimeout(typeaheadTimer);
      typeaheadBuffer += char;

      const match = registry.typeaheadMatch(
        typeaheadBuffer,
        currentId,
        expandedIds,
        activeVisibilityPredicate,
      );
      if (match) focusNode(match);

      typeaheadTimer = setTimeout(() => {
        typeaheadBuffer = '';
        typeaheadTimer = null;
      }, 500);
    },
    expandSiblings(currentId) {
      const siblings = registry.siblingsOf(currentId);
      const branchSiblings = siblings.filter((id) => {
        const node = registry.getNode(id);
        return node?.isBranch() && !expandedIds.includes(id);
      });
      if (branchSiblings.length > 0) {
        expandedIds = [...expandedIds, ...branchSiblings];
      }
    },
    notifyFocus(id) {
      focusedId = id;
    },
  };

  setTreeContext(context);
  setTreeItemParentContext({ parentId: null, level: 1 });

  // ---------------------------------------------------------------------------
  // Keyboard handler (Ctrl/Cmd+A handled at tree level)
  // ---------------------------------------------------------------------------

  function handleKeydown(event: KeyboardEvent): void {
    if (isVirtualizedTree && handleVirtualizedKeydown(event)) return;

    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
      event.preventDefault();
      selectAll();
    }

    if (event.key === 'Escape' && dragController?.dragging) {
      event.preventDefault();
      dragController.cancel();
    }
  }

  function currentVirtualIndex(): number {
    const index = effectiveFocusedId ? visibleIds.indexOf(effectiveFocusedId) : -1;
    return index === -1 ? 0 : index;
  }

  function focusVirtualDelta(delta: number): void {
    const nextIndex = currentVirtualIndex() + delta;
    if (nextIndex < 0 || nextIndex >= visibleIds.length) return;
    void focusVirtualIndex(nextIndex);
  }

  function applyVirtualizedShiftSelection(currentId: string | null, event: KeyboardEvent): void {
    if (!currentId || !event.shiftKey || selectionMode !== 'multiple') return;
    toggleSelectedInternal(currentId, event);
  }

  function expandVirtualizedSiblings(currentId: string | null): void {
    const currentItem = currentId ? flattenedDataItemById.get(currentId) : undefined;
    if (!currentItem) return;
    const siblingBranchIds = flattenedDataItems
      .filter((item) => item.parentId === currentItem.parentId && item.branch)
      .map((item) => item.id);
    const nextIds = withExpandedIds(siblingBranchIds);
    if (nextIds.length !== expandedIds.length) expandedIds = nextIds;
  }

  function handleVirtualizedKeydown(event: KeyboardEvent): boolean {
    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
      event.preventDefault();
      selectAll();
      return true;
    }

    const currentId = effectiveFocusedId;
    const currentItem = currentId ? flattenedDataItemById.get(currentId) : undefined;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        applyVirtualizedShiftSelection(currentId, event);
        focusVirtualDelta(1);
        return true;
      case 'ArrowUp':
        event.preventDefault();
        applyVirtualizedShiftSelection(currentId, event);
        focusVirtualDelta(-1);
        return true;
      case 'Home':
        event.preventDefault();
        void focusVirtualIndex(0);
        return true;
      case 'End':
        event.preventDefault();
        void focusVirtualIndex(visibleIds.length - 1);
        return true;
      case 'ArrowRight':
        event.preventDefault();
        if (!currentItem?.branch) return true;
        if (!virtualizedItemExpanded(currentItem)) {
          setExpandedInternal(currentItem.id, true);
        } else {
          focusFirstVirtualizedChild(currentItem.id);
        }
        return true;
      case 'ArrowLeft':
        event.preventDefault();
        if (currentItem?.branch && expandedIds.includes(currentItem.id)) {
          setExpandedInternal(currentItem.id, false);
        } else if (currentItem?.parentId) {
          focusNode(currentItem.parentId);
        }
        return true;
      case 'Enter':
      case ' ':
        if (!currentItem) return false;
        event.preventDefault();
        activateVirtualizedItemFromKeyboard(currentItem, event);
        return true;
      case '*':
        event.preventDefault();
        expandVirtualizedSiblings(currentId);
        return true;
      default:
        return handleVirtualizedTypeahead(event);
    }
  }

  function handleVirtualizedTypeahead(event: KeyboardEvent): boolean {
    if (
      disableTypeahead ||
      event.key.length !== 1 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return false;
    }

    event.preventDefault();
    if (typeaheadTimer !== null) clearTimeout(typeaheadTimer);
    typeaheadBuffer += event.key.toLowerCase();

    const startIndex = currentVirtualIndex();
    for (let offset = 1; offset <= visibleDataItems.length; offset++) {
      const index = (startIndex + offset) % visibleDataItems.length;
      const item = visibleDataItems[index];
      if (item?.label.toLowerCase().startsWith(typeaheadBuffer)) {
        void focusVirtualIndex(index);
        break;
      }
    }

    typeaheadTimer = setTimeout(() => {
      typeaheadBuffer = '';
      typeaheadTimer = null;
    }, 500);
    return true;
  }

  function updateFilterValue(next: string): void {
    if (!isFilterControlled) uncontrolledFilterValue = next;
    onFilterChange?.(next);
  }

  function handleFilterInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    updateFilterValue(target.value);
  }

  function handleFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const firstVisibleId = visibleIds[0];
      if (firstVisibleId) focusNode(firstVisibleId);
      return;
    }

    if (event.key === 'Escape' && currentFilterValue.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      updateFilterValue('');
      filterInputElement?.focus();
    }
  }

  function pointerTargetElement(
    clientX: number,
    clientY: number,
    fallbackTarget: EventTarget | null,
  ): HTMLElement | null {
    if (typeof document !== 'undefined') {
      const element = document.elementFromPoint(clientX, clientY);
      if (element instanceof HTMLElement) return element;
    }
    return fallbackTarget instanceof HTMLElement ? fallbackTarget : null;
  }

  function updateDragTargetFromPointer(
    clientX: number,
    clientY: number,
    fallbackTarget: EventTarget | null,
  ): void {
    const element = pointerTargetElement(clientX, clientY, fallbackTarget);
    if (!element) return;
    dragController?.setDropTarget(dragController.targetFromPointer(clientY, element));
  }

  function stopDragAutoscroll(): void {
    if (dragScrollAnimationFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(dragScrollAnimationFrame);
    }
    dragScrollAnimationFrame = null;
    dragScrollElement = null;
  }

  function scheduleDragAutoscroll(): void {
    if (
      dragScrollAnimationFrame !== null ||
      !dragController?.pointerDragging ||
      !dragScrollElement ||
      typeof requestAnimationFrame !== 'function'
    ) {
      return;
    }

    dragScrollAnimationFrame = requestAnimationFrame(() => {
      dragScrollAnimationFrame = null;
      const tree = dragScrollElement;
      if (!dragController?.pointerDragging || !tree) return;

      const rect = tree.getBoundingClientRect();
      const edge = 32;
      const speed = 8;
      const previousScrollTop = tree.scrollTop;
      if (latestDragPointerY - rect.top < edge) {
        tree.scrollTop -= speed;
      } else if (rect.bottom - latestDragPointerY < edge) {
        tree.scrollTop += speed;
      }

      if (tree.scrollTop === previousScrollTop) return;
      updateDragTargetFromPointer(latestDragPointerX, latestDragPointerY, tree);
      scheduleDragAutoscroll();
    });
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragController?.pointerDragging) return;
    event.preventDefault();
    latestDragPointerX = event.clientX;
    latestDragPointerY = event.clientY;
    dragScrollElement = event.currentTarget as HTMLElement;
    updateDragTargetFromPointer(event.clientX, event.clientY, event.target);
    scheduleDragAutoscroll();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!dragController?.pointerDragging) return;
    event.preventDefault();
    stopDragAutoscroll();
    dragController.drop();
  }

  function handlePointerCancel(): void {
    if (!dragController?.pointerDragging) return;
    stopDragAutoscroll();
    dragController.cancel();
  }

  function handleVirtualizedItemClick(item: FlattenedTreeDataItem, event: MouseEvent): void {
    focusedId = item.id;
    treeElement?.focus();
    if (event.detail > 1) return;
    if (!item.disabled) toggleSelectedInternal(item.id, event);
    if (item.branch && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      setExpandedInternal(item.id, !expandedIds.includes(item.id));
    }
  }

  function syncVirtualizedCheckboxElement(element: HTMLInputElement, id: string): void {
    const state = selectionStateForId(id);
    element.checked = state.checked;
    element.indeterminate = state.indeterminate && !state.checked;
  }

  function handleVirtualizedCheckboxClick(item: FlattenedTreeDataItem, event: MouseEvent): void {
    event.stopPropagation();
    focusedId = item.id;
    treeElement?.focus();
    toggleSelectionScopeInternal(item.id);

    const checkbox = event.currentTarget;
    if (checkbox instanceof HTMLInputElement) {
      syncVirtualizedCheckboxElement(checkbox, item.id);
    }
  }

  function activateVirtualizedItemFromKeyboard(
    item: FlattenedTreeDataItem,
    event: KeyboardEvent,
  ): void {
    if (item.branch && event.key === 'Enter') {
      setExpandedInternal(item.id, !expandedIds.includes(item.id));
      if (checkboxSelectionActive()) return;
    }

    if (checkboxSelectionActive()) {
      toggleSelectionScopeInternal(item.id);
    } else {
      toggleSelectedInternal(item.id, event);
    }
  }

  function handleVirtualizedItemKeydown(item: FlattenedTreeDataItem, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    focusedId = item.id;
    treeElement?.focus();
    activateVirtualizedItemFromKeyboard(item, event);
  }
</script>

{#snippet virtualizedRows()}
  <div class="cinder-tree__virtual-spacer" style={virtualizedSpacerStyle()}>
    {#each virtualRows as row (row.item.id)}
      {@const virtualItem = row.virtualItem}
      {@const item = row.item}
      {@const itemSelectionState = selectionStateForId(item.id)}
      <div
        {@attach virtualizer.measureElement}
        id={virtualItemElementId(item)}
        role="treeitem"
        class="cinder-tree-item cinder-tree-item--virtual"
        aria-level={item.level}
        aria-expanded={item.branch ? virtualizedItemExpanded(item) : undefined}
        aria-selected={selectionMode === 'none' || checkboxSelectionActive()
          ? undefined
          : selectedIds.includes(item.id)}
        aria-checked={ariaCheckedForSelectionState(itemSelectionState)}
        aria-disabled={item.disabled || undefined}
        aria-setsize={item.setSize}
        aria-posinset={item.posInSet}
        aria-label={item.label}
        tabindex="-1"
        data-cinder-tree-item-id={item.id}
        data-cinder-expanded={item.branch && virtualizedItemExpanded(item) ? '' : undefined}
        data-cinder-selected={selectedIds.includes(item.id) ? '' : undefined}
        data-cinder-disabled={item.disabled ? '' : undefined}
        data-cinder-focused={effectiveFocusedId === item.id ? '' : undefined}
        data-cinder-virtual-index={virtualItem.index}
        style={virtualizedRowStyle(virtualItem.start, virtualItem.size)}
        onclick={(event) => handleVirtualizedItemClick(item, event)}
        onkeydown={(event) => handleVirtualizedItemKeydown(item, event)}
      >
        <div class="cinder-tree-item__row" style={`padding-inline-start: ${item.level * 1.25}rem;`}>
          {#if checkboxSelectionActive()}
            <input
              type="checkbox"
              class="cinder-tree-item__checkbox"
              checked={itemSelectionState.checked}
              disabled={item.disabled}
              tabindex="-1"
              aria-hidden="true"
              onclick={(event) => handleVirtualizedCheckboxClick(item, event)}
              {@attach (node: HTMLInputElement) => {
                $effect(() => {
                  syncVirtualizedCheckboxElement(node, item.id);
                });
              }}
            />
          {/if}
          {#if virtualizedItem}
            {@render virtualizedItem({
              item,
              expanded: virtualizedItemExpanded(item),
              selected: selectedIds.includes(item.id),
              focused: effectiveFocusedId === item.id,
            })}
          {:else}
            <span class="cinder-tree-item__label cinder-_truncate">{item.label}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet treeBody()}
  <div
    {@attach virtualizer.scrollElement}
    bind:this={treeElement}
    {...rest}
    id={treeId}
    role="tree"
    tabindex={isVirtualizedTree ? 0 : -1}
    class={classNames('cinder-tree', className)}
    style={treeStyle()}
    aria-label={resolvedAriaLabel}
    aria-labelledby={resolvedAriaLabelledBy}
    aria-activedescendant={virtualizedActiveDescendantId}
    aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
    aria-busy={filterStatusBusy || undefined}
    data-cinder-checkbox-selection={checkboxSelectionActive() ? '' : undefined}
    data-cinder-virtualized={isVirtualizedTree ? '' : undefined}
    onkeydown={handleKeydown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
  >
    {#if isVirtualizedTree}
      {@render virtualizedRows()}
    {:else}
      {@render children?.()}
    {/if}
  </div>
{/snippet}

{#if hasTreeChrome}
  <div class="cinder-tree-root">
    {#if showSearch}
      <div class="cinder-tree__filter">
        <label class="cinder-sr-only" for={filterInputId}>{resolvedFilterPlaceholder}</label>
        <input
          bind:this={filterInputElement}
          id={filterInputId}
          class="cinder-tree__filter-input"
          type="search"
          value={currentFilterValue}
          placeholder={resolvedFilterPlaceholder}
          aria-label={resolvedFilterPlaceholder}
          aria-controls={treeId}
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          oninput={handleFilterInput}
          onkeydown={handleFilterKeydown}
        />
      </div>
    {/if}

    {#if selectionControls}
      <div class="cinder-tree__selection-controls">
        {@render selectionControls()}
      </div>
    {/if}

    {#if onReorder}
      <div id={dragInstructionsId} class="cinder-sr-only">
        Press Control Shift Space to lift the focused item, or Space from the reorder handle. Use
        arrow keys to move. Press Space to drop, Escape to cancel.
      </div>
    {/if}

    {@render treeBody()}

    {#if hasNoFilterResults}
      <div class="cinder-tree__empty" role="none">No results</div>
    {/if}

    <VisuallyHiddenLiveRegion
      message={filterStatusAnnouncement}
      announcementSequence={filterStatusAnnouncementSequence}
      priority="polite"
    />

    {#if onReorder}
      <VisuallyHiddenLiveRegion
        message={dragAnnouncement}
        announcementSequence={dragAnnouncementSequence}
        priority="assertive"
      />
    {/if}
  </div>
{:else}
  {@render treeBody()}
{/if}

<VisuallyHiddenLiveRegion
  message={expansionAnnouncement}
  announcementSequence={expansionAnnouncementSequence}
  priority="polite"
/>
