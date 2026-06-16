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

  type LabelSegment = {
    text: string;
    highlighted: boolean;
    start: number;
  };

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

  let busy = $state(false);
  let loaded = $state(false);
  let activeController: AbortController | null = null;
  let editing = $state(false);
  let editValue = $state('');
  let renamePending = $state(false);
  let renameError = $state('');
  let renameAnnouncement = $state('');
  let renameAnnouncementSequence = $state(0);
  let probedFilterValue = $state<string | null>(null);

  let outerElement: HTMLElement | undefined = $state();
  let renameInputElement: HTMLInputElement | undefined = $state();
  let dragHandleElement: HTMLButtonElement | undefined = $state();
  const treeItemElementId = $props.id();
  const renameMessageId = $derived(`${treeItemElementId}-rename-message`);

  // ---------------------------------------------------------------------------
  // Derived state from context
  // ---------------------------------------------------------------------------

  // Read reactive arrays directly — Svelte 5 tracks cross-component $state reads.
  const isExpanded = $derived(context.expandedIds.includes(id));
  const isSelected = $derived(context.selectedIds.includes(id));
  const isFocused = $derived(context.focusedId === id);
  const isFiltering = $derived(context.filtering);
  const isVisible = $derived(
    !isFiltering ||
      context.isVisible(id) ||
      (!context.hasRegisteredItems && (isBranch || context.matchesFilter(label, id))),
  );
  const hasVisibleDescendant = $derived(context.hasVisibleDescendant(id));
  const renderedExpanded = $derived(isExpanded || (isFiltering && hasVisibleDescendant));
  const shouldProbeFilterChildren = $derived(
    isBranch && isFiltering && !isExpanded && probedFilterValue !== context.filterValue,
  );
  const shouldRenderChildren = $derived(
    isBranch && (isExpanded || hasVisibleDescendant || shouldProbeFilterChildren),
  );
  const checkboxSelectionActive = $derived(context.checkboxSelectionActive());
  const selectionState = $derived(context.selectionStateFor(id));
  const labelSegments = $derived.by(() => splitLabelForHighlight(label, context.filterValue));
  const canRename = $derived(!disabled && onRename != null);
  const editingLabel = $derived(`Editing: ${label}`);
  const dragController = $derived(context.dragController);
  const canDrag = $derived(draggable && !disabled && dragController != null);
  const isDraggingItem = $derived(dragController?.isDragging(id) ?? false);
  const isDropBefore = $derived(dragController?.isDropTarget(id, 'before') ?? false);
  const isDropAfter = $derived(dragController?.isDropTarget(id, 'after') ?? false);
  const isDropInto = $derived(dragController?.isDropTarget(id, 'child') ?? false);
  const dragHandleLabel = $derived(`Reorder ${label}`);
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
        if (activeController) {
          activeController.abort();
          activeController = null;
        }
        unregister();
      };
    });
  };

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

  const focusRenameInput: Attachment<HTMLInputElement> = (node) => {
    renameInputElement = node;
    queueMicrotask(() => {
      if (!editing || renameInputElement !== node) return;
      node.focus();
      node.select();
    });
    return () => {
      if (renameInputElement === node) renameInputElement = undefined;
    };
  };

  function announceRename(message: string): void {
    renameAnnouncement = message;
    renameAnnouncementSequence += 1;
  }

  function renameFailureMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error) return error;
    return 'Unknown error';
  }

  function focusCurrentTreeItem(): void {
    if (outerElement?.isConnected) {
      outerElement.focus();
      return;
    }

    if (typeof document === 'undefined') return;
    const current = [...document.querySelectorAll<HTMLElement>('[data-cinder-tree-item-id]')].find(
      (element) => element.dataset['cinderTreeItemId'] === id,
    );
    current?.focus();
  }

  function beginEdit(): void {
    if (!canRename || editing) return;
    editValue = label;
    renameError = '';
    renamePending = false;
    editing = true;
    announceRename(`Editing ${label}. Press Enter to confirm, Escape to cancel.`);
  }

  function finishEdit(afterFocus?: () => void): void {
    editing = false;
    renameError = '';
    renamePending = false;
    queueMicrotask(() => {
      focusCurrentTreeItem();
      afterFocus?.();
    });
  }

  function cancelEdit(): void {
    editValue = label;
    announceRename('Rename cancelled.');
    finishEdit();
  }

  async function commitEdit(afterFocus?: () => void): Promise<boolean> {
    if (!editing || renamePending) return false;

    if (editValue.trim().length === 0) {
      renameError = 'Label is required.';
      announceRename(renameError);
      queueMicrotask(() => renameInputElement?.focus());
      return false;
    }

    if (!onRename) {
      finishEdit(afterFocus);
      return true;
    }

    renamePending = true;
    renameError = '';
    try {
      await onRename(id, editValue);
      announceRename(`${editValue}, renamed.`);
      finishEdit(afterFocus);
      return true;
    } catch (error) {
      const message = `Rename failed: ${renameFailureMessage(error)}.`;
      renamePending = false;
      renameError = message;
      announceRename(message);
      queueMicrotask(() => renameInputElement?.focus());
      return false;
    }
  }

  async function commitEditAndMove(direction: 1 | -1): Promise<void> {
    await commitEdit(() => context.focusVisibleDelta(id, direction));
  }

  function handleRenameInputKeydown(event: KeyboardEvent): void {
    event.stopPropagation();

    if (event.key === 'Enter') {
      event.preventDefault();
      void commitEdit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      void cancelEdit();
      return;
    }

    if (event.key === 'Tab') {
      const direction = event.shiftKey ? -1 : 1;
      if (context.canFocusVisibleDelta(id, direction)) {
        event.preventDefault();
        void commitEditAndMove(direction);
      } else {
        void commitEdit();
      }
    }
  }

  function handleRenameInputBlur(): void {
    void commitEdit();
  }

  let dragKeyboardReturnTarget: HTMLElement | undefined;

  function restoreDragKeyboardFocus(): void {
    const target = dragKeyboardReturnTarget ?? dragHandleElement ?? outerElement;
    queueMicrotask(() => target?.focus());
  }

  function canLiftWithKeyboard(event: KeyboardEvent): boolean {
    const fromDragHandle = event.currentTarget === dragHandleElement;
    const treeItemShortcut =
      event.key === ' ' && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
    return (fromDragHandle && (event.key === ' ' || event.key === 'Enter')) || treeItemShortcut;
  }

  function handleDragKeyboard(event: KeyboardEvent): boolean {
    const controller = dragController;
    if (!canDrag || !controller) return false;

    if (!controller.dragging && canLiftWithKeyboard(event)) {
      event.preventDefault();
      event.stopPropagation();
      dragKeyboardReturnTarget =
        event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
      controller.lift(id);
      restoreDragKeyboardFocus();
      return true;
    }

    if (!controller.isDragging(id)) return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        controller.moveBy(1);
        return true;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        controller.moveBy(-1);
        return true;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        controller.moveIntoPreviousBranch();
        return true;
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        controller.moveOut();
        return true;
      case 'Home':
        event.preventDefault();
        event.stopPropagation();
        controller.moveToEdge('first');
        return true;
      case 'End':
        event.preventDefault();
        event.stopPropagation();
        controller.moveToEdge('last');
        return true;
      case ' ':
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        controller.drop();
        restoreDragKeyboardFocus();
        return true;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        controller.cancel();
        restoreDragKeyboardFocus();
        return true;
      default:
        return false;
    }
  }

  function handleDragPointerDown(event: PointerEvent): void {
    const controller = dragController;
    if (!canDrag || !controller || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragHandleElement?.focus();
    dragHandleElement?.setPointerCapture(event.pointerId);
    controller.lift(id);
  }

  function handleDragClick(event: MouseEvent): void {
    event.stopPropagation();
  }

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

    if (handleDragKeyboard(event)) return;

    if (key === 'F2') {
      event.preventDefault();
      beginEdit();
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
        if (context.selectionMode === 'none' && canRename) {
          beginEdit();
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

    if (!disabled && !checkboxSelectionActive) context.toggleSelected(id, event);

    if (isBranch && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      // Plain click on a branch row toggles expand, including disabled branches.
      context.setExpanded(id, !isExpanded);
    }
  }

  function handleLabelDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    beginEdit();
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

  function splitLabelForHighlight(value: string, query: string): LabelSegment[] {
    if (query.length === 0) return [{ text: value, highlighted: false, start: 0 }];

    const matchIndex = value.toLowerCase().indexOf(query.toLowerCase());
    if (matchIndex === -1) return [{ text: value, highlighted: false, start: 0 }];

    const matchEnd = matchIndex + query.length;
    const segments: LabelSegment[] = [];
    if (matchIndex > 0) {
      segments.push({ text: value.slice(0, matchIndex), highlighted: false, start: 0 });
    }
    segments.push({
      text: value.slice(matchIndex, matchEnd),
      highlighted: true,
      start: matchIndex,
    });
    if (matchEnd < value.length) {
      segments.push({ text: value.slice(matchEnd), highlighted: false, start: matchEnd });
    }
    return segments;
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
  aria-label={editing ? editingLabel : undefined}
  aria-labelledby={editing ? undefined : `${treeItemElementId}-label`}
  aria-level={level}
  aria-expanded={isBranch ? renderedExpanded : undefined}
  aria-selected={context.selectionMode === 'none' || checkboxSelectionActive
    ? undefined
    : isSelected}
  aria-checked={ariaChecked}
  aria-busy={busy || undefined}
  aria-disabled={disabled || undefined}
  aria-describedby={canDrag ? context.dragInstructionsId : undefined}
  tabindex={isFocused ? 0 : -1}
  data-cinder-expanded={isBranch && isExpanded ? '' : undefined}
  data-cinder-selected={isSelected ? '' : undefined}
  data-cinder-disabled={disabled ? '' : undefined}
  data-cinder-busy={busy ? '' : undefined}
  data-cinder-hidden={!isVisible ? '' : undefined}
  data-cinder-editing={editing ? '' : undefined}
  data-cinder-tree-item-id={id}
  data-cinder-dragging={isDraggingItem ? '' : undefined}
  data-cinder-drop-target={isDropBefore ? 'before' : isDropAfter ? 'after' : undefined}
  data-cinder-drop-into={isDropInto ? '' : undefined}
  onfocus={handleFocus}
  onkeydown={handleKeydown}
  onclick={handleClick}
>
  <span id={`${treeItemElementId}-label`} class="cinder-sr-only">{label}</span>
  <div class="cinder-tree-item__row">
    {#if canDrag}
      <button
        bind:this={dragHandleElement}
        type="button"
        class="cinder-tree-item__drag-handle"
        aria-label={dragHandleLabel}
        aria-pressed={isDraggingItem}
        aria-describedby={context.dragInstructionsId}
        tabindex="-1"
        onpointerdown={handleDragPointerDown}
        onclickcapture={handleDragClick}
        onkeydown={handleDragKeyboard}
      >
        <span aria-hidden="true">::</span>
      </button>
    {/if}

    {#if row}
      {@render row({
        expanded: isExpanded,
        selected: isSelected,
        busy,
        level,
        checkboxSelection: checkboxSelectionActive,
        selectionState,
        editing,
        beginEdit,
        toggleSelection: toggleSelectionFromRow,
      })}
    {:else if editing}
      <input
        {@attach focusRenameInput}
        type="text"
        class="cinder-tree-item__rename-input"
        bind:value={editValue}
        aria-label={editingLabel}
        aria-invalid={renameError ? 'true' : undefined}
        aria-describedby={renameError ? renameMessageId : undefined}
        disabled={renamePending}
        onkeydown={handleRenameInputKeydown}
        onblur={handleRenameInputBlur}
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
  {#if renameError}
    <span id={renameMessageId} class="cinder-sr-only">{renameError}</span>
  {/if}
  {#if shouldRenderChildren}
    <div role="group" aria-labelledby={treeItemElementId} class="cinder-tree-item__children">
      {@render children?.()}
    </div>
  {/if}
  {#if onRename}
    <VisuallyHiddenLiveRegion
      message={renameAnnouncement}
      announcementSequence={renameAnnouncementSequence}
      priority="assertive"
    />
  {/if}
</div>
