<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Floating toolbar anchored to a text selection that exposes a comment-on-selection action with an inline composer.
   * @tag overlay
   * @tag selection
   * @useWhen Letting readers annotate or comment on a highlighted range of text in a document or article surface.
   * @useWhen Surfacing selection-scoped actions such as quote, share, or comment near the user's pointer.
   * @avoidWhen Anchoring generic non-selection content to a trigger — use popover.
   * @avoidWhen Building a general-purpose floating toolbar unrelated to text selection — compose a popover with custom controls.
   * @related popover
   */
  export type {
    SelectionPopoverPosition,
    SelectionPopoverProps,
  } from './selection-popover.types.ts';
</script>

<script lang="ts">
  import type { Placement, VirtualElement } from '@floating-ui/dom';
  import type { SelectionPopoverProps } from './selection-popover.types.ts';
  import { onDestroy, tick } from 'svelte';

  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { createAnchoredOverlayExitState } from '../../_internal/anchored-overlay-exit.svelte.ts';
  import { createClickOutside } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createPortalAttachment } from '../portal/index.ts';
  import { createVirtualKeyboardDismissal } from './virtual-keyboard-dismissal.svelte.ts';

  let {
    id,
    position,
    open = false,
    onCommentSubmit,
    onExpand,
    onCancel,
    onClose,
    class: customClassName,
    ...rest
  }: SelectionPopoverProps = $props();

  let expanded = $state(false);
  let commentBody = $state('');
  let textareaElement = $state<HTMLTextAreaElement | null>(null);
  let composerFormElement = $state<HTMLDivElement | null>(null);
  let popoverElement = $state<HTMLDivElement | null>(null);
  let restoreFocusElement: HTMLElement | null = null;
  let wasOpen = false;
  let closeRequested = false;
  let isRestoringFocus = false;
  // A count, not a boolean: a multi-pointer gesture (two-finger touch, pen +
  // touch, etc.) can have more than one pointer down at once. Releasing one
  // must not re-arm scroll-dismissal while another is still held.
  let activePointerCount = 0;
  const pointerIsDown = () => activePointerCount > 0;

  // Tracks pointer button state for the component's FULL mounted lifetime —
  // not just while open. A drag-select gesture that opens this popover (via
  // the consumer's selectionchange handler, per selection-popover.examples.json)
  // starts with a pointerdown that happens BEFORE the popover is open/enabled,
  // so movement-dismissal's own gate (in createVirtualKeyboardDismissal, keyed
  // off this getter) needs pointer state that was already being tracked when
  // that pointerdown fired, not state that only starts listening once the
  // popover opens. See createVirtualKeyboardDismissal's isPointerDown option.
  $effect(() => {
    const markPointerDown = () => {
      activePointerCount += 1;
    };
    const markPointerUp = () => {
      activePointerCount = Math.max(0, activePointerCount - 1);
    };
    const pointerTrackingOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('pointerdown', markPointerDown, pointerTrackingOptions);
    window.addEventListener('pointerup', markPointerUp, pointerTrackingOptions);
    window.addEventListener('pointercancel', markPointerUp, pointerTrackingOptions);
    return () => {
      window.removeEventListener('pointerdown', markPointerDown, pointerTrackingOptions);
      window.removeEventListener('pointerup', markPointerUp, pointerTrackingOptions);
      window.removeEventListener('pointercancel', markPointerUp, pointerTrackingOptions);
      activePointerCount = 0;
    };
  });

  const virtualAnchor = $derived.by<VirtualElement | null>(() => {
    if (!position) return null;

    // Use the selection height when provided so floating-ui sees the real bottom
    // edge of the selection. Without this, `bottom` equals `top` (zero-height
    // point anchor), and when `flip` switches to bottom-placement the panel's
    // top is set to `anchor.bottom + offset = position.y + 8` — inside the
    // selection line — causing the observed ~8.5 px overlap (issue #369).
    const selectionHeight = position.height ?? 0;

    return {
      getBoundingClientRect: () =>
        ({
          x: position.x,
          y: position.y,
          top: position.y,
          left: position.x,
          right: position.x,
          bottom: position.y + selectionHeight,
          width: 0,
          height: selectionHeight,
        }) as DOMRect,
    };
  });

  const isPositionedOpen = $derived(open && position != null);

  const reducedMotion = useReducedMotion();
  // Shared anchored-overlay exit-transition lifecycle (OVERLAY-POLICY.md §
  // "Transition lifecycle"). This component never unmounts its own element,
  // so `renderPanel`/`isClosing` drive `data-cinder-visible`/
  // `data-cinder-closing` rather than an `{#if}` gate — but the same
  // await-completion + generation-guard contract applies before the popover
  // is removed from the tab order.
  const exitState = createAnchoredOverlayExitState({
    getOpen: () => isPositionedOpen,
    getPanelElement: () => popoverElement,
    getReducedMotion: () => reducedMotion.current,
  });

  const anchoredOverlay = createAnchoredOverlay({
    open: () => isPositionedOpen || exitState.isClosing,
    anchor: () => virtualAnchor,
    panel: () => popoverElement,
    placement: () => 'top' as Placement,
    offset: () => 8,
    shiftPadding: () => 16,
    shiftCrossAxis: () => true,
    widthMode: () => 'none',
  });
  const portalAttachment = createPortalAttachment({
    target: () => document.body,
    inheritAttributes: true,
  });

  $effect(() => {
    exitState.sync();
  });

  onDestroy(() => {
    exitState.destroy();
  });

  const canSubmit = $derived(commentBody.trim().length > 0);

  function rememberFocus(): void {
    if (restoreFocusElement) return;
    const activeElement = document.activeElement;
    restoreFocusElement = activeElement instanceof HTMLElement ? activeElement : null;
  }

  // The remembered element describes "what had focus before this popover
  // opened", which stays true for the popover's whole open lifetime — not just
  // until the first restore. Keeping the reference here (rather than spending
  // it) is what lets a second restore work: expand -> cancel restores once
  // while the popover stays open, and a later Escape must restore again
  // instead of dropping focus on <body> (issue #1269). The reference is
  // released where the `wasOpen` latch resets, so the next open re-arms it,
  // and by onFocusMovedOutside once the user genuinely moves on.
  function restoreFocus(preventScroll = true): void {
    const target = restoreFocusElement;
    if (!target) return;
    // Focus is already where it belongs, so there is nothing to restore. Now
    // that the reference outlives the first restore, this is what keeps an
    // external close following an internal cancel/submit from driving focus
    // onto the same element a second time.
    if (document.activeElement === target) return;
    // .focus() dispatches `focusin` synchronously, and the window-level
    // ownership-tracking listener below can't otherwise tell this
    // component-driven restoration apart from the user genuinely moving on
    // to something outside the popover. Flag it so that listener exempts it.
    // Load-bearing now that the reference outlives the restore: without the
    // exemption, restoring to the (outside-the-popover) pre-open owner would
    // trip onFocusMovedOutside and clear the very reference we are keeping.
    isRestoringFocus = true;
    target.focus({ preventScroll });
    isRestoringFocus = false;
  }

  function requestClose(preventScroll = false): void {
    if (closeRequested) return;
    closeRequested = true;
    onClose?.();
    restoreFocus(preventScroll);
    // The latch only needs to survive the current synchronous burst of
    // scroll/resize events (so a coalesced movement dismisses once, not
    // once per event). Release it on a microtask so a controlled consumer
    // that declines the close (keeps `open` true, e.g. to let re-expansion
    // happen) doesn't leave every later Escape/outside-click/scroll/resize
    // dismissal permanently swallowed.
    queueMicrotask(() => {
      closeRequested = false;
    });
  }

  function closePopover(): void {
    requestClose();
  }

  function handleExpand(): void {
    rememberFocus();
    expanded = true;
    onExpand?.();
    // tick() resolves once Svelte flushes the expanded state to the DOM (so the
    // textarea exists), aligned with the codebase's flush timing — faster and
    // more idiomatic than waiting a paint frame via requestAnimationFrame.
    void tick().then(() => textareaElement?.focus({ preventScroll: true }));
  }

  function handleCancel(): void {
    expanded = false;
    commentBody = '';
    onCancel?.();
    restoreFocus();
  }

  function handleSubmit(): void {
    const trimmedBody = commentBody.trim();
    if (!trimmedBody) return;

    onCommentSubmit?.(trimmedBody);
    expanded = false;
    commentBody = '';
    restoreFocus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      if (expanded) {
        handleCancel();
      } else {
        closePopover();
      }
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && !expanded && !event.defaultPrevented) {
      event.preventDefault();
      handleExpand();
    }
  }

  function handleTextareaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }

  // Outside-pointerdown dismiss via the shared overlay primitive (OVERLAY-POLICY § Outside-click).
  // pointerdown (not click) so the popover closes before a fresh text selection commits.
  // $derived keeps the attachment stable across renders (recreating it would re-bind the
  // document listener every update); enabled gates it to the open state.
  const dismissOnOutsidePointerdown = $derived(
    // capture: false preserves the original bubble-phase semantics
    // (the previous document.addEventListener call had no capture arg).
    createClickOutside({
      handler: closePopover,
      enabled: () => isPositionedOpen,
      eventType: 'pointerdown',
      capture: false,
    }),
  );

  createVirtualKeyboardDismissal({
    enabled: () => isPositionedOpen,
    panel: () => popoverElement,
    composerForm: () => composerFormElement,
    composerOwnsKeyboard: () => expanded || commentBody.trim().length > 0,
    isRestoringFocus: () => isRestoringFocus,
    isPointerDown: pointerIsDown,
    onDismiss: (preventScroll) => requestClose(preventScroll),
    onFocusMovedOutside: () => {
      restoreFocusElement = null;
    },
  });

  $effect(() => {
    if (!isPositionedOpen) {
      // Only act on the true -> false transition. This keeps the close logic
      // (state reset + focus restore) from re-running on unrelated effect
      // re-evaluations while already closed.
      if (wasOpen) {
        wasOpen = false;
        expanded = false;
        commentBody = '';
        // Return focus to wherever it was before the popover opened, then
        // release the reference: this open session is over, so the next open
        // must re-arm from whatever has focus then rather than reuse a stale
        // element. restoreFocus() null-guards and no-ops when the target
        // already has focus, so an internal close that already restored does
        // not drive focus a second time.
        restoreFocus();
        restoreFocusElement = null;
      }
      return;
    }

    // Capture the pre-open focus owner once, on the false -> true transition,
    // before focus can move into the popover. This guarantees something to
    // restore to on an external close even if the popover is never expanded,
    // while never re-capturing mid-open (which would otherwise re-grab focus
    // after an internal close-and-restore left the popover open).
    if (!wasOpen) {
      wasOpen = true;
      closeRequested = false;
      rememberFocus();
    }
  });
</script>

<div
  bind:this={popoverElement}
  {id}
  class={classNames('cinder-selection-popover', customClassName)}
  data-cinder-expanded={expanded ? '' : undefined}
  data-cinder-position-ready={anchoredOverlay.positionReady}
  data-cinder-placement={anchoredOverlay.resolvedPlacement}
  data-cinder-visible={exitState.renderPanel || undefined}
  data-cinder-closing={exitState.isClosing || undefined}
  style={anchoredOverlay.positionStyle}
  role="toolbar"
  aria-label="Selection actions"
  onkeydown={handleKeydown}
  {@attach portalAttachment}
  {@attach dismissOnOutsidePointerdown}
  {...rest}
>
  {#if expanded}
    <div bind:this={composerFormElement} class="cinder-selection-popover__form">
      <textarea
        bind:this={textareaElement}
        bind:value={commentBody}
        class="cinder-selection-popover__textarea"
        aria-label="Comment text"
        placeholder="Add a comment..."
        rows={2}
        onkeydown={handleTextareaKeydown}
      ></textarea>
      <div class="cinder-selection-popover__actions">
        <button
          type="button"
          class="cinder-selection-popover__cancel"
          onclick={handleCancel}
          aria-label="Cancel"
        >
          <svg class="cinder-selection-popover__icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <button
          type="button"
          class="cinder-selection-popover__submit"
          onclick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Submit comment"
          title="Submit comment"
        >
          <svg class="cinder-selection-popover__icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      class="cinder-selection-popover__button"
      onclick={handleExpand}
      aria-label="Add comment"
      title="Add comment to selection"
    >
      <svg class="cinder-selection-popover__icon" aria-hidden="true" viewBox="0 0 24 24">
        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h6" />
        <path d="M19 3v6" />
        <path d="M16 6h6" />
      </svg>
    </button>
  {/if}
</div>
