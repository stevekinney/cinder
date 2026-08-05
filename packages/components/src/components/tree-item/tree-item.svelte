<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Node within a tree that exposes a label, optional children, and expand and selection state through the tree context.
   * @tag tree
   * @tag node
   * @useWhen Rendering a single branch or leaf inside a tree parent.
   * @useWhen Nesting further tree-items as children to form a hierarchy.
   * @avoidWhen Standing alone outside a tree — it requires the tree context and registry.
   * @related tree
   */
  export type { TreeItemProps } from './tree-item.types.ts';
</script>

<script lang="ts">
  import type { TreeItemProps } from './tree-item.types.ts';
  import { tick, untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import type { TreeContext } from '../../_internal/tree-context.ts';
  import {
    getTreeContext,
    setTreeItemParentContext,
    tryGetTreeItemParentContext,
  } from '../../_internal/tree-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import { TreeItemAsyncLoader } from './tree-item-async-load.svelte.ts';
  import { TreeItemDragHandlers } from './tree-item-drag.svelte.ts';
  import { splitLabelForHighlight } from './tree-item-label-highlight.ts';
  import { TreeItemRenameController } from './tree-item-rename.svelte.ts';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    id,
    label,
    disabled = false,
    draggable = false,
    branch = false,
    loadChildren,
    onLoadError,
    onRename,
    selectionScopeIds,
    row,
    children,
    class: className,
  }: TreeItemProps = $props();

  // ---------------------------------------------------------------------------
  // Contexts (read at init time — must not be inside onMount)
  // ---------------------------------------------------------------------------

  const context: TreeContext = getTreeContext();

  const parentContext = tryGetTreeItemParentContext();
  const parentId = parentContext?.parentId ?? null;
  const level = parentContext?.level ?? 1;

  // Publish context for our own children
  setTreeItemParentContext({
    get parentId() {
      return id;
    },
    get level() {
      return level + 1;
    },
  });

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  const isBranch = $derived(branch || loadChildren != null);

  let probedFilterValue = $state<string | null>(null);

  let outerElement: HTMLElement | undefined = $state();
  let dragHandleElement: HTMLButtonElement | undefined = $state();
  const treeItemElementId = $props.id();

  const asyncLoader = new TreeItemAsyncLoader({
    getId: () => id,
    getLoadChildren: () => loadChildren,
    getOnLoadError: () => onLoadError,
    setExpanded: (itemId, expanded) => context.setExpanded(itemId, expanded),
  });

  const renameController = new TreeItemRenameController({
    getId: () => id,
    getLabel: () => label,
    getOnRename: () => onRename,
    getDisabled: () => disabled,
    getOuterElement: () => outerElement,
    getElementId: () => treeItemElementId,
    canFocusVisibleDelta: (direction) => context.canFocusVisibleDelta(id, direction),
    focusVisibleDelta: (direction) => context.focusVisibleDelta(id, direction),
  });

  // ---------------------------------------------------------------------------
  // Derived state from context
  // ---------------------------------------------------------------------------

  // Read reactive arrays directly — Svelte 5 tracks cross-component $state reads.
  const isExpanded = $derived(context.expandedIds.includes(id));
  const isSelected = $derived(context.selectedIds.includes(id));
  const isFocused = $derived(context.focusedId === id);
  const positionInSet = $derived(context.positionInSet(id));
  const setSize = $derived(context.setSize(id));
  const isFiltering = $derived(context.filtering);
  const isVisible = $derived(
    !isFiltering ||
      context.isVisible(id) ||
      (!context.hasRegisteredItems && (isBranch || context.matchesFilter(label, id))),
  );
  const hasVisibleDescendant = $derived(context.hasVisibleDescendant(id));
  const renderedExpanded = $derived(isExpanded || (isFiltering && hasVisibleDescendant));
  const filterForcedOpen = $derived(isBranch && isFiltering && hasVisibleDescendant && !isExpanded);
  const shouldProbeFilterChildren = $derived(
    isBranch && isFiltering && !isExpanded && probedFilterValue !== context.filterValue,
  );
  const shouldRenderChildren = $derived(
    isBranch && (isExpanded || hasVisibleDescendant || shouldProbeFilterChildren),
  );
  const checkboxSelectionActive = $derived(context.checkboxSelectionActive());
  const selectionState = $derived(context.selectionStateFor(id));
  const labelSegments = $derived.by(() => splitLabelForHighlight(label, context.filterValue));
  const dragController = $derived(context.dragController);
  const canDrag = $derived(draggable && !disabled && dragController != null);

  const dragHandlers = new TreeItemDragHandlers({
    getDragController: () => dragController,
    getId: () => id,
    getLabel: () => label,
    getCanDrag: () => canDrag,
    getDragHandleElement: () => dragHandleElement,
    getOuterElement: () => outerElement,
  });

  const ariaChecked = $derived.by(() => {
    if (!checkboxSelectionActive) return undefined;
    if (selectionState.indeterminate) return 'mixed';
    return selectionState.checked ? 'true' : 'false';
  });

  $effect(() => {
    if (!isFiltering) {
      probedFilterValue = null;
      return;
    }
    if (!shouldProbeFilterChildren) return;

    const filterValueAtProbeStart = context.filterValue;
    tick().then(() => {
      if (context.filtering && context.filterValue === filterValueAtProbeStart) {
        probedFilterValue = filterValueAtProbeStart;
      }
    });
  });

  let checkboxElement: HTMLInputElement | undefined = $state();

  // The native checkbox is a CONTROLLED input. `.checked` is also set
  // declaratively on the element (`checked={selectionState.checked}`) so SSR
  // renders the correct initial state, but that declarative attribute is not
  // sufficient on its own: Svelte only writes `.checked` when the bound VALUE
  // changes between renders; it does not re-assert it on every flush. The
  // input's DOM `.checked`/`.indeterminate` are mutated out-of-band by native
  // checkbox interaction, so a residual native mutation whose authoritative
  // value did not change is left un-healed by the declarative attribute alone.
  // This imperative write re-asserts both properties on every reactive flush to
  // reconcile the visible checkbox against native mutation; it always writes the
  // same authoritative `selectionState`, so it never conflicts with the
  // declarative attribute. `aria-checked` (below) is the assistive-tech source
  // of truth and stays correct independently.
  function syncCheckboxToSelectionState(): void {
    if (!checkboxElement) return;
    checkboxElement.checked = selectionState.checked;
    checkboxElement.indeterminate = selectionState.indeterminate && !selectionState.checked;
  }

  // Reactive reconciliation: re-runs whenever `selectionState` (a fresh object
  // from `context.selectionStateFor` each flush) changes.
  $effect(syncCheckboxToSelectionState);

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  // Register with the parent tree at attach time so the registry has the DOM
  // node available for document-order sorting. Cleanup runs on detach.
  const registerWithTree: Attachment<HTMLElement> = (node) => {
    // Attachments run inside a tracked $effect. Wrap registration in untrack so
    // the side-effectful mutation of the parent's registry doesn't create a
    // reactive dependency loop through derived visible-id lists.
    return untrack(() => {
      const unregister = context.register({
        id,
        parentId,
        level,
        node,
        // disabled is a getter so runtime prop changes stay in sync with the registry
        get disabled() {
          return disabled;
        },
        selectionScopeIds: () => selectionScopeIds,
        isBranch: () => isBranch,
        bulkExpandable: () => loadChildren == null,
        label: () => label,
        focus: () => outerElement?.focus(),
      });

      return () => {
        // Abort any in-flight async load when the item unmounts
        asyncLoader.abort();
        unregister();
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Async loading
  // ---------------------------------------------------------------------------

  // When expanded for the first time with a loadChildren, trigger the load
  $effect(() => {
    if (isExpanded && loadChildren && !asyncLoader.loaded && !asyncLoader.busy) {
      asyncLoader.trigger();
    }
  });

  // Abort in-flight load when collapsing
  $effect(() => {
    if (!isExpanded && asyncLoader.busy) {
      asyncLoader.abort();
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

  function toggleKeyboardSelection(event: KeyboardEvent): void {
    if (disabled) return;
    if (checkboxSelectionActive) {
      context.toggleSelectionScope(id);
    } else {
      context.toggleSelected(id, event);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    // Ownership guard: if event came from a nested child treeitem, skip
    if (isFromNestedItem(event)) return;
    // Skip if target is an interactive descendant (button inside row, etc.)
    if (isInteractiveDescendant(event.target)) return;

    const key = event.key;

    if (dragHandlers.handleKeyboard(event)) return;

    if (key === 'F2') {
      event.preventDefault();
      renameController.beginEdit();
      return;
    }

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (event.shiftKey && context.selectionMode === 'multiple') {
          toggleKeyboardSelection(event);
          context.focusVisibleDelta(id, 1);
        } else {
          context.focusVisibleDelta(id, 1);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (event.shiftKey && context.selectionMode === 'multiple') {
          toggleKeyboardSelection(event);
          context.focusVisibleDelta(id, -1);
        } else {
          context.focusVisibleDelta(id, -1);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (!isBranch) break;
        if (!renderedExpanded) {
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
        if (context.selectionMode === 'none' && renameController.canRename) {
          renameController.beginEdit();
          break;
        }
        if (checkboxSelectionActive) {
          if (isBranch) {
            context.setExpanded(id, !isExpanded);
          } else if (!disabled) {
            context.toggleSelectionScope(id);
          }
        } else {
          if (!disabled) context.toggleSelected(id, event);
          if (isBranch) context.setExpanded(id, !isExpanded);
        }
        break;

      case ' ':
        event.preventDefault();
        if (!disabled) {
          if (checkboxSelectionActive) {
            context.toggleSelectionScope(id);
          } else {
            context.toggleSelected(id, event);
            // Space does NOT toggle expand on branches (per APG)
          }
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

    if (event.detail > 1) return;

    if (disabled) {
      if (isBranch) context.setExpanded(id, !isExpanded);
      return;
    }

    if (!checkboxSelectionActive) context.toggleSelected(id, event);

    if (isBranch && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      context.setExpanded(id, !isExpanded);
    }
  }

  function handleDisclosureClick(event: MouseEvent): void {
    event.stopPropagation();
    outerElement?.focus();
    context.setExpanded(id, !isExpanded);
  }

  function handleLabelDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    renameController.beginEdit();
  }

  function handleCheckboxActivation(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    outerElement?.focus();
    if (!disabled) context.toggleSelectionScope(id);

    // A native checkbox click flips `.checked` during dispatch, and Chromium
    // applies the `preventDefault()` revert at the END of the dispatching task
    // — AFTER this synchronous handler returns AND after all microtasks drain
    // (so after Svelte's flush, the reactive $effect, and any tick()/microtask
    // re-assert). That late revert clobbers a microtask write, leaving the
    // visible checkbox desynced from the authoritative selectionState. The
    // re-sync therefore has to land in a LATER task: requestAnimationFrame runs
    // on the next frame, strictly after the browser's post-dispatch revert, so
    // it reads the now-current `selectionState` and settles the controlled
    // input on the authoritative value. `globalThis.requestAnimationFrame` is
    // guarded for non-DOM (server/test) environments where it is undefined.
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(syncCheckboxToSelectionState);
    }
  }

  function toggleSelectionFromRow(): void {
    if (!disabled) context.toggleSelectionScope(id);
  }
</script>

{#snippet visibleLabel()}
  {#each labelSegments as segment (`${segment.start}-${segment.highlighted}-${segment.text}`)}
    {#if segment.highlighted}
      <mark aria-hidden="true" class="cinder-tree-item__highlight">{segment.text}</mark>
    {:else}
      {segment.text}
    {/if}
  {/each}
{/snippet}

<div
  bind:this={outerElement}
  {@attach registerWithTree}
  role="treeitem"
  id={treeItemElementId}
  class={classNames('cinder-tree-item', className)}
  aria-label={renameController.editing ? renameController.editingLabel : undefined}
  aria-labelledby={renameController.editing ? undefined : `${treeItemElementId}-label`}
  aria-level={level}
  aria-expanded={isBranch ? renderedExpanded : undefined}
  aria-posinset={positionInSet}
  aria-setsize={setSize}
  aria-selected={context.selectionMode === 'none' || checkboxSelectionActive
    ? undefined
    : isSelected}
  aria-checked={ariaChecked}
  aria-busy={asyncLoader.busy || undefined}
  aria-disabled={disabled || undefined}
  aria-describedby={canDrag ? context.dragInstructionsId : undefined}
  tabindex={isFocused ? 0 : -1}
  data-cinder-expanded={isBranch && isExpanded ? '' : undefined}
  data-cinder-selected={isSelected ? '' : undefined}
  data-cinder-disabled={disabled ? '' : undefined}
  data-cinder-busy={asyncLoader.busy ? '' : undefined}
  data-cinder-hidden={!isVisible ? '' : undefined}
  data-cinder-editing={renameController.editing ? '' : undefined}
  data-cinder-tree-item-id={id}
  data-cinder-dragging={dragHandlers.isDraggingItem ? '' : undefined}
  data-cinder-drop-target={dragHandlers.isDropBefore
    ? 'before'
    : dragHandlers.isDropAfter
      ? 'after'
      : undefined}
  data-cinder-drop-into={dragHandlers.isDropInto ? '' : undefined}
  onfocus={handleFocus}
  onkeydown={handleKeydown}
  onclick={handleClick}
>
  <span id={`${treeItemElementId}-label`} class="cinder-sr-only">{label}</span>
  <div class="cinder-tree-item__row">
    {#if isBranch && !filterForcedOpen}
      <button
        type="button"
        class="cinder-tree-item__disclosure"
        aria-label={`${renderedExpanded ? 'Collapse' : 'Expand'} ${label}`}
        aria-expanded={renderedExpanded}
        tabindex="-1"
        onclick={handleDisclosureClick}
      >
        <span aria-hidden="true"></span>
      </button>
    {:else}
      <span class="cinder-tree-item__disclosure-spacer" aria-hidden="true"></span>
    {/if}

    {#if canDrag}
      <button
        bind:this={dragHandleElement}
        type="button"
        class="cinder-tree-item__drag-handle"
        aria-label={dragHandlers.dragHandleLabel}
        aria-pressed={dragHandlers.isDraggingItem}
        aria-describedby={context.dragInstructionsId}
        tabindex="-1"
        onpointerdown={dragHandlers.handlePointerDown}
        onclickcapture={dragHandlers.handleClick}
        onkeydown={dragHandlers.handleKeyboard}
      >
        <span aria-hidden="true">::</span>
      </button>
    {/if}

    {#if row}
      {@render row({
        expanded: isExpanded,
        selected: isSelected,
        busy: asyncLoader.busy,
        level,
        checkboxSelection: checkboxSelectionActive,
        selectionState,
        editing: renameController.editing,
        beginEdit: () => renameController.beginEdit(),
        toggleSelection: toggleSelectionFromRow,
      })}
    {:else if renameController.editing}
      <input
        {@attach renameController.attachInput}
        type="text"
        class="cinder-tree-item__rename-input"
        bind:value={renameController.editValue}
        aria-label={renameController.editingLabel}
        aria-invalid={renameController.renameError ? 'true' : undefined}
        aria-describedby={renameController.renameError ? renameController.messageId : undefined}
        disabled={renameController.renamePending}
        onkeydown={renameController.handleInputKeydown}
        onblur={renameController.handleInputBlur}
      />
    {:else if checkboxSelectionActive}
      <!--
        `checked` is set BOTH declaratively and imperatively, by design — the
        two cover different render phases and are not redundant:

        • The declarative `checked={selectionState.checked}` is the ONLY write
          that happens during SSR (the $effect below does not run on the
          server). Without it, an initially-selected item renders unchecked in
          the SSR HTML and only corrects after hydration, causing a flash.

        • The $effect above re-asserts `.checked`/`.indeterminate` on every
          reactive flush. This is what the declarative attribute alone cannot
          do: Svelte only writes `.checked` when the bound VALUE changes between
          renders, so a residual native mutation (from the pre-handler checkbox
          click) whose authoritative value did NOT change would be left un-healed.

        • The rAF re-sync in `handleCheckboxActivation` heals the post-revert
          state after Chromium reverts `.checked` at the end of the dispatch task.

        The declarative attribute only ever writes the authoritative
        `selectionState.checked`, the same value the $effect and rAF write, so it
        never fights them or reintroduces the stale-mutation bug. `indeterminate`
        has no declarative form and stays owned solely by the $effect/rAF.
      -->
      <input
        bind:this={checkboxElement}
        type="checkbox"
        class="cinder-tree-item__checkbox"
        checked={selectionState.checked}
        {disabled}
        tabindex="-1"
        aria-hidden="true"
        onclick={handleCheckboxActivation}
      />
      <!--
        aria-hidden prevents the visible default text from being announced
        separately since the parent treeitem is labelled by the visually-hidden
        label span above.
      -->
      <span
        aria-hidden="true"
        class="cinder-tree-item__label cinder-_truncate"
        ondblclick={handleLabelDoubleClick}>{@render visibleLabel()}</span
      >
    {:else}
      <!--
        aria-hidden prevents the visible default text from being announced
        separately since the parent treeitem is labelled by the visually-hidden
        label span above.
      -->
      <span
        aria-hidden="true"
        class="cinder-tree-item__label cinder-_truncate"
        ondblclick={handleLabelDoubleClick}>{@render visibleLabel()}</span
      >
    {/if}
  </div>
  {#if renameController.renameError}
    <span id={renameController.messageId} class="cinder-sr-only"
      >{renameController.renameError}</span
    >
  {/if}
  {#if shouldRenderChildren}
    <div role="group" aria-labelledby={treeItemElementId} class="cinder-tree-item__children">
      {@render children?.()}
    </div>
  {/if}
  {#if onRename}
    <VisuallyHiddenLiveRegion
      message={renameController.renameAnnouncement}
      announcementSequence={renameController.renameAnnouncementSequence}
      priority="assertive"
    />
  {/if}
</div>
