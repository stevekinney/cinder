<script lang="ts" module>
  export const TREE_CONTEXT_KEY = Symbol('cinder-tree');
  export const TREE_ITEM_PARENT_KEY = Symbol('cinder-tree-item-parent');

  export type { TreeProps, TreeSelectionMode } from './tree.types.ts';
</script>

<script lang="ts">
  import type { TreeProps } from './tree.types.ts';
  import { setContext } from 'svelte';

  import type { TreeContext, TreeItemParentContext } from '../../_internal/tree-context.ts';
  import { TreeRegistry } from '../../_internal/tree-registry.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    selectionMode = 'none',
    selectedIds = $bindable([]),
    expandedIds = $bindable([]),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    disableTypeahead = false,
    class: className,
    children,
  }: TreeProps = $props();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const registry = new TreeRegistry();
  let focusedId = $state<string | null>(null);

  // Anchor for shift-select range
  let selectionAnchorId = $state<string | null>(null);

  // Typeahead buffer
  let typeaheadBuffer = $state('');
  let typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

  // Warn once when no accessible label is provided
  let hasWarnedNoLabel = false;

  $effect(() => {
    if (!ariaLabel && !ariaLabelledBy && !hasWarnedNoLabel) {
      hasWarnedNoLabel = true;
      console.warn('[cinder-tree] Tree requires either aria-label or aria-labelledby.');
    }
  });

  // Clear typeahead timer on unmount
  $effect(() => {
    return () => {
      if (typeaheadTimer !== null) {
        clearTimeout(typeaheadTimer);
        typeaheadTimer = null;
      }
    };
  });

  // ---------------------------------------------------------------------------
  // Derived visible list
  // ---------------------------------------------------------------------------

  const visibleIds = $derived.by(() => registry.getVisible(expandedIds));

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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function focusNode(id: string): void {
    focusedId = id;
    registry.getNode(id)?.focus();
  }

  function focusFallbackAfterUnregister(parentId: string | null): void {
    const currentVisibleIds = registry.getVisible(expandedIds);
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

  function toggleSelectedInternal(id: string, event: KeyboardEvent | MouseEvent | null): void {
    const node = registry.getNode(id);
    if (!node || node.disabled) return;
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
        const rangeNode = registry.getNode(rangeId);
        return rangeNode && !rangeNode.disabled;
      });
      selectedIds = rangeIds;
    } else if (isMeta) {
      // Ctrl/Cmd toggles individual
      selectedIds = selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id];
      selectionAnchorId = id;
    } else {
      selectedIds = selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id];
      selectionAnchorId = id;
    }
  }

  function selectAll(): void {
    if (selectionMode !== 'multiple') return;
    const allVisible = visibleIds.filter((id) => {
      const node = registry.getNode(id);
      return node && !node.disabled;
    });
    selectedIds = allVisible;
    // Guarded by length, so the first selected id is present.
    if (allVisible.length > 0) selectionAnchorId = allVisible[0]!;
  }

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------

  const context: TreeContext = {
    get selectionMode() {
      return selectionMode;
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
    isExpanded(id) {
      return expandedIds.includes(id);
    },
    isSelected(id) {
      return selectedIds.includes(id);
    },
    isFocused(id) {
      return effectiveFocusedId === id;
    },
    setExpanded: setExpandedInternal,
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
      const childId = registry.firstChildOf(currentId);
      if (childId) focusNode(childId);
    },
    handleTypeahead(char, currentId) {
      if (disableTypeahead) return;

      if (typeaheadTimer !== null) clearTimeout(typeaheadTimer);
      typeaheadBuffer += char;

      const match = registry.typeaheadMatch(typeaheadBuffer, currentId, expandedIds);
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

  setContext(TREE_CONTEXT_KEY, context);
  setContext(TREE_ITEM_PARENT_KEY, { parentId: null, level: 1 } as TreeItemParentContext);

  // ---------------------------------------------------------------------------
  // Keyboard handler (Ctrl/Cmd+A handled at tree level)
  // ---------------------------------------------------------------------------

  function handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
      event.preventDefault();
      selectAll();
    }
  }
</script>

<div
  role="tree"
  class={classNames('cinder-tree', className)}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledBy}
  aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
  onkeydown={handleKeydown}
>
  {@render children()}
</div>
