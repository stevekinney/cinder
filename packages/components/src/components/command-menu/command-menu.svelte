<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Inline caret-anchored slash-command list for textareas and single-line text inputs.
   * @tag overlay
   * @tag command
   * @useWhen Showing a contextual command list at the caret while a user types in a textarea or input.
   * @useWhen Building slash-command insertion flows where the host owns text replacement.
   * @avoidWhen Exposing a global app launcher — use command-palette instead.
   * @avoidWhen Selecting from a static form option list — use combobox instead.
   * @related command-palette, command-item, popover, combobox
   */
  export type {
    CommandMenuCompletion,
    CommandMenuProps,
    CommandMenuSelection,
    CommandMenuState,
    CommandMenuTriggerMatch,
  } from './command-menu.types.ts';
  export { detectTrigger } from './command-menu-trigger.ts';
</script>

<script lang="ts">
  import type { CommandMenuProps } from './command-menu.types.ts';
  import { getCaretRect } from './caret-rect.svelte.ts';
  import {
    computeGhostOverlayFontStyle,
    createInlineCompletionState,
  } from './command-menu-inline-completion.svelte.ts';
  import type { VirtualElement } from '@floating-ui/dom';
  import { on } from 'svelte/events';

  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { isRightToLeftElement } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { setCommandListContext } from '../_internal/command-list-context.ts';
  import { createCommandListState } from '../_internal/create-command-list-state.svelte.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  const fallbackListboxId = $props.id();

  let {
    listboxId = fallbackListboxId,
    open = $bindable(false),
    anchor,
    caretIndex: caretIndexProp,
    query = $bindable(''),
    items,
    empty,
    placement = 'bottom-start',
    offset = 6,
    label = 'Commands',
    onSelect,
    onComplete,
    onDismiss,
    onStateChange,
    class: className,
  }: CommandMenuProps = $props();

  const portalAttachment = createPortalAttachment({
    target: () => document.body,
    inheritAttributes: true,
    source: () => anchor,
  });

  let mounted = $state(false);
  let listElement: HTMLElement | undefined = $state();
  // Bumped by every anchor selection/scroll/resize event the ghost-text
  // wiring below cares about — DOM properties like `selectionEnd` aren't
  // reactive on their own, so derived reads that need to stay live on plain
  // caret movement (not just prop changes) take a dependency on this.
  let selectionGeneration = $state(0);
  let composing = $state(false);
  let dismissedTrigger: {
    anchor: HTMLInputElement | HTMLTextAreaElement;
    value: string;
    caretIndex: number;
    selectionStart: number | null;
    selectionEnd: number | null;
  } | null = $state(null);
  const commandList = createCommandListState(() => listboxId);

  const showEmpty = $derived(
    mounted && open && commandList.registrationsReady && commandList.registrations.length === 0,
  );
  // Only render an aria-describedby/geometry hook when the empty state is
  // actually rendered (showEmpty AND an `empty` snippet was passed) — a
  // dangling aria-describedby pointing at a nonexistent id is invalid ARIA.
  const showEmptyState = $derived(showEmpty && Boolean(empty));
  const emptyStateId = $derived(`${commandList.listboxId}-empty`);
  // Optional-with-derivation (see command-menu.a11y.md): a consumer that
  // doesn't already track trigger-relative caret state can omit this prop
  // entirely and read the anchor's live selection instead.
  const caretIndex = $derived.by(() => {
    if (caretIndexProp !== undefined) return caretIndexProp;
    void selectionGeneration;
    return anchor?.selectionEnd ?? 0;
  });
  const caretAnchor = $derived.by<VirtualElement | null>(() => {
    const anchorElement = anchor;
    const currentCaretIndex = caretIndex;
    if (!anchorElement) return null;
    return {
      getBoundingClientRect() {
        return (
          getCaretRect(anchorElement, currentCaretIndex) ?? anchorElement.getBoundingClientRect()
        );
      },
    };
  });

  const anchoredOverlay = createAnchoredOverlay({
    open: () => open,
    anchor: () => caretAnchor,
    panel: () => listElement,
    placement: () => placement,
    offset: () => offset,
    widthMode: () => 'content',
  });

  // ---------------------------------------------------------------------
  // Ghost-text inline completion (see command-menu.a11y.md for the recorded
  // decisions). `createInlineCompletionState` owns whether to show ghost
  // text and what it says; everything below is this component's DOM-facing
  // half — live caret-end tracking, the active item's raw value, and the
  // overlay's own position/font styling.
  // ---------------------------------------------------------------------
  const caretAtFieldEnd = $derived.by(() => {
    void selectionGeneration;
    void query;
    const currentAnchor = anchor;
    if (!currentAnchor) return false;
    return (
      currentAnchor.selectionStart === currentAnchor.selectionEnd &&
      currentAnchor.selectionEnd === currentAnchor.value.length
    );
  });

  const activeValue = $derived.by(() => {
    const id = open ? commandList.activeItemId : null;
    if (id === null) return null;
    const record = commandList.registrations.find((registration) => registration.id === id);
    return record?.getValue() ?? null;
  });

  const inlineCompletion = createInlineCompletionState({
    enabled: () => Boolean(onComplete),
    open: () => open,
    composing: () => composing,
    caretAtFieldEnd: () => caretAtFieldEnd,
    rightToLeft: () => isRightToLeftElement(anchor),
    query: () => query,
    caretIndex: () => caretIndex,
    activeItemId: () => (open ? commandList.activeItemId : null),
    activeValue: () => activeValue,
  });

  const ghostRect = $derived.by(() => {
    void selectionGeneration;
    if (!anchor || !inlineCompletion.visible) return null;
    return getCaretRect(anchor, anchor.value.length);
  });

  const ghostStyle = $derived.by(() => {
    if (!anchor) return '';
    const rect = ghostRect;
    // No `height` here: the rect's height is a line-height estimate from
    // getCaretRect, not a hard glyph box — clamping to it would clip a
    // descender in the rendered text.
    const position = rect
      ? `position: fixed; left: ${rect.left}px; top: ${rect.top}px;`
      : 'position: fixed;';
    return `${position} ${computeGhostOverlayFontStyle(anchor)}`;
  });

  const ghostPortalAttachment = createPortalAttachment({
    target: () => document.body,
    inheritAttributes: true,
    source: () => anchor,
  });

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    commandList.syncListboxId(listboxId);
  });

  $effect(() => {
    const currentAnchor = anchor;
    const currentValue = currentAnchor?.value;
    if (
      dismissedTrigger &&
      (dismissedTrigger.anchor !== currentAnchor ||
        dismissedTrigger.value !== currentValue ||
        dismissedTrigger.caretIndex !== caretIndex)
    ) {
      dismissedTrigger = null;
    }
    if (
      open &&
      dismissedTrigger &&
      dismissedTrigger.anchor === currentAnchor &&
      dismissedTrigger.value === currentValue &&
      dismissedTrigger.caretIndex === caretIndex
    ) {
      open = false;
    }
  });

  $effect(() => {
    const currentAnchor = anchor;
    if (!currentAnchor) return;

    function clearDismissalWhenSelectionMoves() {
      if (
        dismissedTrigger?.anchor === currentAnchor &&
        (dismissedTrigger.value !== currentAnchor.value ||
          dismissedTrigger.selectionStart !== currentAnchor.selectionStart ||
          dismissedTrigger.selectionEnd !== currentAnchor.selectionEnd)
      ) {
        dismissedTrigger = null;
      }
      selectionGeneration += 1;
    }

    const stopSelectionchange = on(
      currentAnchor,
      'selectionchange',
      clearDismissalWhenSelectionMoves,
    );
    const stopSelect = on(currentAnchor, 'select', clearDismissalWhenSelectionMoves);
    const stopInput = on(currentAnchor, 'input', clearDismissalWhenSelectionMoves);
    const stopClick = on(currentAnchor, 'click', clearDismissalWhenSelectionMoves);
    const stopKeyup = on(currentAnchor, 'keyup', clearDismissalWhenSelectionMoves);

    return () => {
      stopSelectionchange();
      stopSelect();
      stopInput();
      stopClick();
      stopKeyup();
    };
  });

  // The ghost overlay is positioned via a one-shot rect read (no
  // floating-ui autoUpdate loop), so scroll/resize need their own nudge to
  // stay live. Anchor-local scroll (a tall textarea's own scrollbar) and
  // page/ancestor scroll are different events; both can move the caret's
  // viewport position. Gated on `inlineCompletion.visible` — this is the
  // only time repositioning matters, so a closed menu or a host that never
  // enables ghost text never pays for these listeners.
  //
  // The window `scroll` listener is capture-phase and unthrottled, so it
  // fires for scroll anywhere in the document while ghost text is visible.
  // Coalesce with `requestAnimationFrame`: collapse any number of scroll
  // events within one frame into a single `selectionGeneration` bump, which
  // is the only thing that triggers the expensive `getCaretRect` mirror-div
  // read/write cycle downstream.
  $effect(() => {
    if (!anchor || !inlineCompletion.visible) return;
    const currentAnchor = anchor;

    let pendingFrame: number | null = null;
    const bumpSelectionGeneration = () => {
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        selectionGeneration += 1;
      });
    };
    const stopAnchorScroll = on(currentAnchor, 'scroll', bumpSelectionGeneration);
    const stopWindowScroll = on(window, 'scroll', bumpSelectionGeneration, { capture: true });
    const stopWindowResize = on(window, 'resize', bumpSelectionGeneration);

    return () => {
      stopAnchorScroll();
      stopWindowScroll();
      stopWindowResize();
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
    };
  });

  $effect(() => {
    if (!open) {
      commandList.resetActiveItem();
      return;
    }
  });

  $effect(() => {
    void query;
    commandList.refreshRegistrationsReady();
  });

  $effect(() => {
    onStateChange?.({
      listboxId: commandList.listboxId,
      activeItemId: open ? commandList.activeItemId : null,
    });
  });

  $effect(() => {
    commandList.scrollActiveItemIntoView();
  });

  function activateItemById(id: string) {
    const record = commandList.activateItemById(id);
    if (!record) return;
    // The command list activates the item callback first; the menu-level
    // `onSelect` prop then receives the committed value and query.
    onSelect?.({ value: record.getValue(), query });
  }

  setCommandListContext(commandList.createContext(activateItemById));

  function dismiss({ latch = false }: { latch?: boolean } = {}) {
    if (!open) return;
    if (latch && anchor) {
      dismissedTrigger = {
        anchor,
        value: anchor.value,
        caretIndex,
        selectionStart: anchor.selectionStart,
        selectionEnd: anchor.selectionEnd,
      };
    }
    open = false;
    onDismiss?.();
  }

  function isModifiedKey(event: KeyboardEvent): boolean {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;

    const isComposingEvent = event.isComposing || event.keyCode === 229;

    // Escape's first stage: dismiss the ghost text without closing the
    // menu. Only a second Escape (ghost already hidden) falls through to
    // the existing listbox Escape-dismiss latch below.
    if (!isComposingEvent && event.key === 'Escape' && inlineCompletion.dismissGhostText()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // ArrowRight at the field end and unmodified Tab accept the ghost
    // text. Enter is deliberately left untouched below — it always
    // activates the listbox selection regardless of ghost-text state.
    if (
      !isComposingEvent &&
      inlineCompletion.visible &&
      !isModifiedKey(event) &&
      (event.key === 'ArrowRight' || event.key === 'Tab')
    ) {
      const completion = inlineCompletion.acceptCompletion();
      if (completion) {
        // stopPropagation, not just preventDefault: preventDefault only
        // suppresses the native action (focus traversal for Tab). Left to
        // bubble, an ancestor keydown listener (a FocusTrap, another
        // overlay) could still act on the same Tab press and move focus
        // anyway, breaking "Tab accepts and keeps focus on the anchor."
        event.preventDefault();
        event.stopPropagation();
        onComplete?.(completion);
        return;
      }
    }

    commandList.handleKeydown({
      event,
      onEnter: activateItemById,
      onEscape: () => dismiss({ latch: true }),
      ignoreModifiedNavigation: true,
    });
  }

  function handleDocumentPointerdown(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (anchor?.contains(target)) return;
    if (listElement?.contains(target)) return;
    dismiss();
  }

  $effect(() => {
    if (!open || !anchor) return;
    const stopKeydown = on(anchor, 'keydown', handleKeydown);
    const stopCompositionStart = on(anchor, 'compositionstart', () => {
      composing = true;
    });
    const stopCompositionEnd = on(anchor, 'compositionend', () => {
      composing = false;
    });
    const stopPointerdown = on(document, 'pointerdown', handleDocumentPointerdown, {
      capture: true,
    });

    return () => {
      stopKeydown();
      stopCompositionStart();
      stopCompositionEnd();
      stopPointerdown();
      // A `compositionstart` with no matching `compositionend` (menu closed
      // by an outside pointerdown, host-controlled dismiss, etc. while an
      // IME composition is in flight) would otherwise latch `composing` true
      // forever — the only thing that ever clears it is a `compositionend`
      // event on listeners this cleanup just removed. Reset here so every
      // fresh open starts from a clean, non-composing state.
      composing = false;
    };
  });
</script>

{#if mounted && open && anchor && inlineCompletion.visible}
  <span
    {@attach ghostPortalAttachment}
    aria-hidden="true"
    class="cinder-_floating-surface cinder-command-menu__ghost"
    data-cinder-position-ready={ghostRect !== null}
    style={ghostStyle}>{inlineCompletion.remainder}</span
  >
{/if}

{#if mounted && open && anchor}
  <div
    bind:this={listElement}
    {@attach portalAttachment}
    aria-hidden={anchoredOverlay.positionReady ? undefined : 'true'}
    class={classNames('cinder-_floating-surface', 'cinder-command-menu', className)}
    data-cinder-position-ready={anchoredOverlay.positionReady}
    style={anchoredOverlay.positionStyle}
  >
    <ul
      id={commandList.listboxId}
      role="listbox"
      aria-label={label}
      aria-describedby={showEmptyState ? emptyStateId : undefined}
      class="cinder-command-menu__listbox"
      data-cinder-empty={showEmptyState || undefined}
    >
      {@render items({ query })}
    </ul>
    {#if showEmptyState && empty}
      <div id={emptyStateId} class="cinder-command-menu__empty" role="status">
        {@render empty()}
      </div>
    {/if}
  </div>
{/if}
