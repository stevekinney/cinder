<script lang="ts" module>
  export type { TreeItemProps } from './tree-item.types.ts';
</script>

<script lang="ts">
  import type { TreeItemProps } from './tree-item.types.ts';
  import { getContext, onMount, setContext } from 'svelte';

  import type { TreeContext, TreeItemParentContext } from '../../_internal/tree-context.ts';
  import { TREE_CONTEXT_KEY, TREE_ITEM_PARENT_KEY } from '../tree/tree.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    id,
    label,
    disabled = false,
    branch = false,
    loadChildren,
    onLoadError,
    row,
    children,
    class: className,
  }: TreeItemProps = $props();

  // ---------------------------------------------------------------------------
  // Contexts (read at init time — must not be inside onMount)
  // ---------------------------------------------------------------------------

  const treeContext = getContext<TreeContext | undefined>(TREE_CONTEXT_KEY);
  if (!treeContext) {
    throw new Error('TreeItem must be used inside a Tree component.');
  }
  const context: TreeContext = treeContext;

  const parentContext = getContext<TreeItemParentContext | undefined>(TREE_ITEM_PARENT_KEY);
  const parentId = parentContext?.parentId ?? null;
  const level = parentContext?.level ?? 1;

  // Publish context for our own children
  setContext<TreeItemParentContext>(TREE_ITEM_PARENT_KEY, { parentId: id, level: level + 1 });

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  const isBranch = $derived(branch || loadChildren != null);

  let busy = $state(false);
  let loaded = $state(false);
  let activeController: AbortController | null = null;

  let outerElement: HTMLElement | undefined = $state();
  const treeItemElementId = useId('cinder-tree-item');

  // ---------------------------------------------------------------------------
  // Derived state from context
  // ---------------------------------------------------------------------------

  // Read reactive arrays directly — Svelte 5 tracks cross-component $state reads.
  const isExpanded = $derived(context.expandedIds.includes(id));
  const isSelected = $derived(context.selectedIds.includes(id));
  const isFocused = $derived(context.focusedId === id);

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  onMount(() => {
    const unregister = context.register({
      id,
      parentId,
      level,
      // disabled is a getter so runtime prop changes stay in sync with the registry
      get disabled() {
        return disabled;
      },
      isBranch: () => isBranch,
      label: () => label,
      focus: () => outerElement?.focus(),
    });

    return () => {
      // Abort any in-flight async load when the item unmounts
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
      unregister();
    };
  });

  // ---------------------------------------------------------------------------
  // Async loading
  // ---------------------------------------------------------------------------

  async function triggerLoad(): Promise<void> {
    if (!loadChildren || loaded || busy) return;

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    busy = true;

    try {
      await loadChildren({ id, signal: controller.signal });
      if (!controller.signal.aborted) {
        loaded = true;
        busy = false;
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        // Only clear busy if this is still the active load. If a newer load
        // has already started (expand→collapse→expand race), clearing busy
        // here would cause the $effect to re-fire and start a load cascade.
        if (activeController === controller) busy = false;
        return;
      }
      busy = false;
      loaded = false;
      // Collapse the branch on error
      context.setExpanded(id, false);
      if (onLoadError) {
        onLoadError(error, id);
      } else {
        console.error('[cinder-tree] loadChildren failed for item', id, error);
      }
    }
  }

  // When expanded for the first time with a loadChildren, trigger the load
  $effect(() => {
    if (isExpanded && loadChildren && !loaded && !busy) {
      triggerLoad();
    }
  });

  // Abort in-flight load when collapsing
  $effect(() => {
    if (!isExpanded && busy && activeController) {
      activeController.abort();
      activeController = null;
      busy = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Event helpers: interactive-descendant guard
  // ---------------------------------------------------------------------------

  const INTERACTIVE_SELECTOR =
    'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="checkbox"], [contenteditable]';

  function isInteractiveDescendant(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    // Walk up to the row wrapper, looking for interactive elements
    let node: Element | null = target;
    while (node && node !== outerElement) {
      if (node.matches(INTERACTIVE_SELECTOR)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function isFromNestedItem(event: Event): boolean {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    // Check if the closest treeitem ancestor of the target is NOT this element
    const closestTreeItem = target.closest('[role="treeitem"]');
    return closestTreeItem !== outerElement;
  }

  // ---------------------------------------------------------------------------
  // Keyboard handler
  // ---------------------------------------------------------------------------

  function handleKeydown(event: KeyboardEvent): void {
    // Ownership guard: if event came from a nested child treeitem, skip
    if (isFromNestedItem(event)) return;
    // Skip if target is an interactive descendant (button inside row, etc.)
    if (isInteractiveDescendant(event.target)) return;

    const key = event.key;

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (event.shiftKey && context.selectionMode === 'multiple') {
          if (!disabled) context.toggleSelected(id, event);
          context.focusVisibleDelta(id, 1);
        } else {
          context.focusVisibleDelta(id, 1);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (event.shiftKey && context.selectionMode === 'multiple') {
          if (!disabled) context.toggleSelected(id, event);
          context.focusVisibleDelta(id, -1);
        } else {
          context.focusVisibleDelta(id, -1);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (!isBranch) break;
        if (!isExpanded) {
          context.setExpanded(id, true);
        } else {
          context.focusFirstChild(id);
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (isBranch && isExpanded) {
          context.setExpanded(id, false);
        } else {
          context.focusParent(id);
        }
        break;

      case 'Home':
        event.preventDefault();
        context.focusFirstVisible();
        break;

      case 'End':
        event.preventDefault();
        context.focusLastVisible();
        break;

      case 'Enter':
        event.preventDefault();
        if (!disabled) {
          context.toggleSelected(id, event);
        }
        if (isBranch) context.setExpanded(id, !isExpanded);
        break;

      case ' ':
        event.preventDefault();
        if (!disabled) {
          context.toggleSelected(id, event);
          // Space does NOT toggle expand on branches (per APG)
        }
        break;

      case '*':
        event.preventDefault();
        context.expandSiblings(id);
        break;

      default:
        // Typeahead: printable single character
        if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          context.handleTypeahead(key, id);
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Click handler
  // ---------------------------------------------------------------------------

  function handleFocus(): void {
    context.notifyFocus(id);
  }

  function handleClick(event: MouseEvent): void {
    if (isFromNestedItem(event)) return;
    if (isInteractiveDescendant(event.target)) return;

    outerElement?.focus();

    if (!disabled) context.toggleSelected(id, event);

    if (isBranch && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      // Plain click on a branch row toggles expand, including disabled branches.
      context.setExpanded(id, !isExpanded);
    }
  }
</script>

<div
  bind:this={outerElement}
  role="treeitem"
  id={treeItemElementId}
  class={classNames('cinder-tree-item', className)}
  aria-labelledby={`${treeItemElementId}-label`}
  aria-level={level}
  aria-expanded={isBranch ? isExpanded : undefined}
  aria-selected={context.selectionMode === 'none' ? undefined : isSelected}
  aria-busy={busy || undefined}
  aria-disabled={disabled || undefined}
  tabindex={isFocused ? 0 : -1}
  data-cinder-expanded={isBranch && isExpanded ? '' : undefined}
  data-cinder-selected={isSelected ? '' : undefined}
  data-cinder-disabled={disabled ? '' : undefined}
  data-cinder-busy={busy ? '' : undefined}
  onfocus={handleFocus}
  onkeydown={handleKeydown}
  onclick={handleClick}
>
  <span id={`${treeItemElementId}-label`} class="cinder-sr-only">{label}</span>
  <div class="cinder-tree-item__row">
    {#if row}
      {@render row({ expanded: isExpanded, selected: isSelected, busy, level })}
    {:else}
      <!--
        aria-hidden prevents the visible default text from being announced
        separately since the parent treeitem is labelled by the visually-hidden
        label span above.
      -->
      <span aria-hidden="true">{label}</span>
    {/if}
  </div>
  {#if isBranch && isExpanded}
    <div role="group" aria-labelledby={treeItemElementId} class="cinder-tree-item__children">
      {@render children?.()}
    </div>
  {/if}
</div>
