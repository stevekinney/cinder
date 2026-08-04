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
  import { tick } from 'svelte';

  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { createClickOutside } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createPortalAttachment } from '../portal/index.ts';

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

  const anchoredOverlay = createAnchoredOverlay({
    open: () => isPositionedOpen,
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

  const canSubmit = $derived(commentBody.trim().length > 0);

  function rememberFocus(): void {
    if (restoreFocusElement) return;
    const activeElement = document.activeElement;
    restoreFocusElement = activeElement instanceof HTMLElement ? activeElement : null;
  }

  function restoreFocus(preventScroll = true): void {
    const target = restoreFocusElement;
    restoreFocusElement = null;
    if (!target) return;
    // .focus() dispatches `focusin` synchronously, and the window-level
    // ownership-tracking listener below can't otherwise tell this
    // component-driven restoration apart from the user genuinely moving on
    // to something outside the popover. Flag it so that listener exempts it.
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

  function isVirtualKeyboardResize(source: 'window' | 'visual-viewport'): boolean {
    const visualViewport = window.visualViewport;
    if (source === 'visual-viewport' && visualViewport?.scale !== 1) return false;

    const virtualKeyboard = (
      navigator as Navigator & {
        virtualKeyboard?: { boundingRect?: { height: number } };
      }
    ).virtualKeyboard;
    if ((virtualKeyboard?.boundingRect?.height ?? 0) > 0) return true;

    if (source === 'window') return false;

    return visualViewport != null && visualViewport.height < window.innerHeight;
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

  $effect(() => {
    if (!isPositionedOpen) return;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    const visualViewport = window.visualViewport;
    const virtualKeyboardWasVisible = {
      window: isVirtualKeyboardResize('window'),
      'visual-viewport': isVirtualKeyboardResize('visual-viewport'),
    };
    const virtualKeyboardTransitionFrames: Partial<Record<'window' | 'visual-viewport', number>> =
      {};
    let layoutKeyboardVisible = false;
    let layoutKeyboardResizeActive = false;
    let layoutKeyboardScrollsSeen = 0;
    let layoutKeyboardSettleFrames: number[] = [];
    const virtualKeyboard = (
      navigator as Navigator & {
        virtualKeyboard?: { boundingRect?: DOMRectReadOnly };
      }
    ).virtualKeyboard;
    layoutKeyboardVisible = Boolean(virtualKeyboard?.boundingRect?.height);
    const markLayoutKeyboardResize = () => {
      layoutKeyboardResizeActive = true;
      layoutKeyboardScrollsSeen = 0;
      for (const frame of layoutKeyboardSettleFrames) window.cancelAnimationFrame(frame);
      layoutKeyboardSettleFrames = [];
      const settle = (remaining: number) => {
        if (remaining === 0) {
          layoutKeyboardResizeActive = false;
          return;
        }
        layoutKeyboardSettleFrames.push(window.requestAnimationFrame(() => settle(remaining - 1)));
      };
      settle(2);
    };
    // Latches "the composer owned this keyboard transition" across the async
    // close burst. A cancel/submit collapses the composer (and clears
    // commentBody) synchronously, before the keyboard's closing resize
    // arrives, so deriving ownership from the *current* expanded/commentBody
    // state at event time would read false and let the collapse-triggered
    // resize fall through to closeForMovement() — dismissing the popover the
    // cancel was meant to leave open. Instead we remember ownership from the
    // moment the keyboard was last seen visible and only forget it once the
    // transition settles (mirrors the virtualKeyboardWasVisible bookkeeping).
    const virtualKeyboardOwnedByComposer: Partial<Record<'window' | 'visual-viewport', boolean>> =
      {};
    // Once focus genuinely moves outside the popover, ownership is forgotten
    // for the rest of this keyboard-visible transition — even if `expanded`
    // or a draft still reads true — so a real external keyboard (belonging
    // to whatever the user tabbed to) can't be re-claimed by the composer's
    // now-stale state on the very next event.
    const keyboardOwnershipForgotten = new Set<'window' | 'visual-viewport'>();
    const readVirtualKeyboardTransition = (
      source: 'window' | 'visual-viewport',
      composerOwnsKeyboardNow: boolean,
    ) => {
      const isVisible = isVirtualKeyboardResize(source);
      if (isVisible) {
        const pendingFrame = virtualKeyboardTransitionFrames[source];
        if (pendingFrame !== undefined) {
          window.cancelAnimationFrame(pendingFrame);
          delete virtualKeyboardTransitionFrames[source];
        }
        virtualKeyboardWasVisible[source] = true;
        // Only ever latch ownership to true here, never downgrade an
        // already-true latch back to false. A Cancel/submit collapses the
        // composer (composerOwnsKeyboardNow -> false) before the keyboard
        // reports itself hidden, and an intervening event while it's still
        // visible would otherwise overwrite the ownership this latch exists
        // to preserve across that gap. A forgotten latch stays forgotten
        // until the transition settles, so it can't be immediately
        // re-claimed by stale composer state either.
        const ownedByComposer = keyboardOwnershipForgotten.has(source)
          ? false
          : (virtualKeyboardOwnedByComposer[source] ?? false) || composerOwnsKeyboardNow;
        virtualKeyboardOwnedByComposer[source] = ownedByComposer;
        return { active: true, isVisible, ownedByComposer };
      }
      if (!virtualKeyboardWasVisible[source])
        return { active: false, isVisible, ownedByComposer: composerOwnsKeyboardNow };

      if (composerOwnsKeyboardNow && !keyboardOwnershipForgotten.has(source))
        virtualKeyboardOwnedByComposer[source] = true;
      const ownedByComposer = virtualKeyboardOwnedByComposer[source] ?? composerOwnsKeyboardNow;

      virtualKeyboardTransitionFrames[source] ??= window.requestAnimationFrame(() => {
        virtualKeyboardWasVisible[source] = false;
        delete virtualKeyboardTransitionFrames[source];
        delete virtualKeyboardOwnedByComposer[source];
        keyboardOwnershipForgotten.delete(source);
      });
      return { active: true, isVisible, ownedByComposer };
    };
    const closeForMovement = () => {
      requestClose(true);
    };
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && popoverElement?.contains(event.target)) return;
      if (event.type === 'scroll' && layoutKeyboardResizeActive) {
        if (layoutKeyboardScrollsSeen < 2) {
          layoutKeyboardScrollsSeen += 1;
          return;
        }
        layoutKeyboardResizeActive = false;
      }
      if (event.type === 'resize') {
        const viewportWidthChanged = window.innerWidth !== viewportWidth;
        const viewportHeightChanged = window.innerHeight !== viewportHeight;
        const previousViewportHeight = viewportHeight;
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        const composerHasFocus =
          document.activeElement instanceof Node &&
          composerFormElement?.contains(document.activeElement);
        const composerOwnedKeyboardNow = expanded || commentBody.trim().length > 0;
        const virtualKeyboardTransition = readVirtualKeyboardTransition(
          'window',
          composerOwnedKeyboardNow,
        );
        if (virtualKeyboardTransition.active && !virtualKeyboardTransition.isVisible)
          markLayoutKeyboardResize();
        const layoutKeyboardResize =
          composerHasFocus &&
          viewportHeightChanged &&
          window.innerHeight < previousViewportHeight &&
          visualViewport != null &&
          visualViewport.height < previousViewportHeight;
        if (layoutKeyboardResize) {
          layoutKeyboardVisible = true;
          markLayoutKeyboardResize();
        }
        const closingLayoutKeyboard =
          composerHasFocus &&
          viewportHeightChanged &&
          window.innerHeight > previousViewportHeight &&
          layoutKeyboardVisible;
        if (closingLayoutKeyboard) {
          layoutKeyboardVisible = false;
          markLayoutKeyboardResize();
        }
        if (
          !viewportWidthChanged &&
          (!viewportHeightChanged ||
            virtualKeyboardTransition.active ||
            layoutKeyboardResize ||
            closingLayoutKeyboard) &&
          (composerHasFocus ||
            (virtualKeyboardTransition.active && virtualKeyboardTransition.ownedByComposer))
        ) {
          return;
        }
      }
      closeForMovement();
    };
    const dismissVisualViewport = (event: Event) => {
      const composerHasFocus =
        document.activeElement instanceof Node &&
        composerFormElement?.contains(document.activeElement);
      const composerOwnedKeyboardNow = expanded || commentBody.trim().length > 0;
      const virtualKeyboardTransition =
        visualViewport?.scale === 1
          ? readVirtualKeyboardTransition('visual-viewport', composerOwnedKeyboardNow)
          : { active: false, isVisible: false, ownedByComposer: composerOwnedKeyboardNow };
      if ((event.type === 'resize' || event.type === 'scroll') && layoutKeyboardResizeActive) {
        if (event.type === 'scroll' && layoutKeyboardScrollsSeen < 2) {
          layoutKeyboardScrollsSeen += 1;
          return;
        }
        if (event.type === 'resize') return;
        layoutKeyboardResizeActive = false;
      }
      if (
        (event.type === 'resize' || event.type === 'scroll') &&
        virtualKeyboardTransition.active &&
        (composerHasFocus || virtualKeyboardTransition.ownedByComposer)
      ) {
        return;
      }
      closeForMovement();
    };
    // A cancel/submit that only returns focus to the pre-open owner (or drops
    // it entirely) still leaves the composer "in charge" of the in-flight
    // keyboard close, so the latch above should survive it. But once focus
    // lands on something outside this popover entirely, the interaction has
    // genuinely moved on — drop the latch so a later keyboard-close resize is
    // free to dismiss (see "an external visual-viewport keyboard close
    // dismisses a collapsed popover").
    const forgetComposerKeyboardOwnershipOnExternalFocus = (event: FocusEvent) => {
      if (isRestoringFocus) return;
      if (event.target instanceof Node && popoverElement?.contains(event.target)) {
        // Focus genuinely returned to the composer (e.g. the user tapped
        // away and back while the keyboard stayed up). A keyboard
        // interaction it triggers from here should be able to establish
        // ownership again, rather than staying forgotten until the whole
        // transition settles.
        keyboardOwnershipForgotten.delete('window');
        keyboardOwnershipForgotten.delete('visual-viewport');
        return;
      }
      // document.body is where the platform (and our own restoreFocus() calls)
      // parks focus when the previously-focused element is removed or isn't
      // focusable — it is never a real destination the user chose, so it
      // isn't evidence the interaction moved on.
      if (event.target === document.body) return;
      // The user has deliberately moved focus to a real destination outside
      // the popover (e.g. tabbing out to another control). A later movement
      // dismissal's restoreFocus() must not steal focus back from it, so
      // drop the saved restoration target along with the keyboard latches.
      // Mark ownership forgotten (not just clear it) so `expanded` or a
      // leftover draft can't immediately re-claim it as composer-owned on
      // the very next event while the keyboard is still visible.
      restoreFocusElement = null;
      delete virtualKeyboardOwnedByComposer.window;
      delete virtualKeyboardOwnedByComposer['visual-viewport'];
      keyboardOwnershipForgotten.add('window');
      keyboardOwnershipForgotten.add('visual-viewport');
    };
    const windowScrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    const visualViewportScrollOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener('scroll', dismiss, windowScrollOptions);
    window.addEventListener('resize', dismiss);
    window.addEventListener('focusin', forgetComposerKeyboardOwnershipOnExternalFocus);
    visualViewport?.addEventListener('scroll', dismissVisualViewport, visualViewportScrollOptions);
    visualViewport?.addEventListener('resize', dismissVisualViewport);
    return () => {
      for (const frame of Object.values(virtualKeyboardTransitionFrames)) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
      }
      for (const frame of layoutKeyboardSettleFrames) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', dismiss, windowScrollOptions);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('focusin', forgetComposerKeyboardOwnershipOnExternalFocus);
      visualViewport?.removeEventListener(
        'scroll',
        dismissVisualViewport,
        visualViewportScrollOptions,
      );
      visualViewport?.removeEventListener('resize', dismissVisualViewport);
    };
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
        // Return focus to wherever it was before the popover opened.
        // restoreFocus() null-guards and clears the ref, so an internal close
        // that already restored leaves this a safe no-op (no double-restore).
        restoreFocus();
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
