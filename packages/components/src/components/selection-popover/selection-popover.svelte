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
  import type { SelectionPopoverProps } from './selection-popover.types.ts';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';

  import { createClickOutside } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    id,
    position,
    open = false,
    oncommentsubmit,
    onexpand,
    oncancel,
    onclose,
    class: customClassName,
    ...rest
  }: SelectionPopoverProps = $props();

  let expanded = $state(false);
  let commentBody = $state('');
  let textareaElement = $state<HTMLTextAreaElement | null>(null);
  let popoverElement = $state<HTMLDivElement | null>(null);
  let restoreFocusElement = $state<HTMLElement | null>(null);
  let measuredWidth = $state(0);
  let measuredHeight = $state(0);
  let wasOpen = false;

  const VIEWPORT_MARGIN = 16;

  const positionStyle = $derived.by(() => {
    if (!position) return '';

    const viewportWidth = innerWidth.current;
    const viewportHeight = innerHeight.current;

    if (viewportWidth == null || viewportHeight == null) {
      const halfWidth = Math.max(measuredWidth / 2, 0);
      const x = Math.max(VIEWPORT_MARGIN + halfWidth, position.x);
      const y = Math.max(VIEWPORT_MARGIN, position.y);
      return `left: ${x}px; top: ${y}px;`;
    }

    const halfWidth = Math.max(measuredWidth / 2, 0);
    const height = Math.max(measuredHeight, 0);
    const x = Math.max(
      VIEWPORT_MARGIN + halfWidth,
      Math.min(position.x, viewportWidth - halfWidth - VIEWPORT_MARGIN),
    );
    const y = Math.max(
      VIEWPORT_MARGIN,
      Math.min(position.y, viewportHeight - height - VIEWPORT_MARGIN),
    );

    return `left: ${x}px; top: ${y}px;`;
  });

  const canSubmit = $derived(commentBody.trim().length > 0);

  function rememberFocus(): void {
    if (restoreFocusElement) return;
    const activeElement = document.activeElement;
    restoreFocusElement = activeElement instanceof HTMLElement ? activeElement : null;
  }

  function restoreFocus(): void {
    restoreFocusElement?.focus();
    restoreFocusElement = null;
  }

  function closePopover(): void {
    onclose?.();
    restoreFocus();
  }

  function handleExpand(): void {
    rememberFocus();
    expanded = true;
    onexpand?.();
    requestAnimationFrame(() => textareaElement?.focus());
  }

  function handleCancel(): void {
    expanded = false;
    commentBody = '';
    oncancel?.();
    restoreFocus();
  }

  function handleSubmit(): void {
    const trimmedBody = commentBody.trim();
    if (!trimmedBody) return;

    oncommentsubmit?.(trimmedBody);
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
    createClickOutside({ handler: closePopover, enabled: () => open, eventType: 'pointerdown' }),
  );

  $effect(() => {
    if (!popoverElement) return;

    try {
      if (open && position) {
        popoverElement.showPopover();
      } else {
        popoverElement.hidePopover();
      }
    } catch {
      // Browsers without the Popover API still render the positioned fallback.
    }
  });

  $effect(() => {
    if (!open) {
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
      rememberFocus();
    }
  });
</script>

<div
  bind:this={popoverElement}
  bind:clientWidth={measuredWidth}
  bind:clientHeight={measuredHeight}
  {id}
  class={classNames('cinder-selection-popover', customClassName)}
  data-cinder-expanded={expanded ? '' : undefined}
  style={positionStyle}
  popover="manual"
  role="toolbar"
  aria-label="Selection actions"
  onkeydown={handleKeydown}
  {@attach dismissOnOutsidePointerdown}
  {...rest}
>
  {#if expanded}
    <div class="cinder-selection-popover__form">
      <textarea
        bind:this={textareaElement}
        bind:value={commentBody}
        class="cinder-selection-popover__textarea"
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
