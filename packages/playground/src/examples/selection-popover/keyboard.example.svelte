<script lang="ts" module>
  export const title = 'Keyboard submit after selection';
  export const description =
    'Select text (by mouse or keyboard) to open the composer, then press Cmd+Enter or Ctrl+Enter to submit. The composer collapses back to the icon — the popover does not stay expanded.';
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  const popoverId = 'keyboard-selection-popover';
  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let lastSubmitted = $state<string | null>(null);

  /**
   * A bound reference to the text surface element.
   * Used in the document-level selectionchange handler to scope
   * selection detection to this element's subtree.
   */
  let surfaceElement = $state<HTMLElement | null>(null);

  function getSelectionAnchor(surface: HTMLElement): SelectionPopoverPosition | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) return null;

    const rect =
      Array.from(range.getClientRects()).find((clientRect) => {
        return clientRect.width > 0 && clientRect.height > 0;
      }) ?? range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) return null;

    return {
      x: rect.left + rect.width / 2,
      y: rect.top,
      height: rect.height,
    };
  }

  /**
   * `selectionchange` fires on document, not on elements.
   * Register at document level and scope to the surface via
   * the bound surfaceElement reference.
   *
   * Keyboard selection (Shift+Arrow, Shift+Home, Shift+End, etc.) fires
   * selectionchange just like mouse-driven selection — so keyboard users
   * get the same popover trigger without any extra wiring.
   *
   * Guard: when the selection collapses because the user clicked inside the
   * popover (e.g. the "Add comment" button or the textarea), do NOT close the
   * popover mid-interaction.  Two checks mirror the production review-editor
   * pattern:
   *
   *   1. Focus containment — document.activeElement is inside the popover root.
   *      Covers the common case and all non-Safari browsers.
   *
   *   2. data-cinder-expanded attribute — the SelectionPopover component sets
   *      this on its root element while the comment form is open.  Safari does
   *      not move focus to buttons on click, so the focus check alone would
   *      miss that case.
   */
  onMount(() => {
    function handleSelectionChange(): void {
      if (!surfaceElement) return;

      // Don't close the popover while the user is interacting with it.
      const popoverElement = document.getElementById(popoverId);
      if (popoverElement?.contains(document.activeElement)) return;
      if (popoverElement?.hasAttribute('data-cinder-expanded')) return;

      const anchor = getSelectionAnchor(surfaceElement);
      if (anchor) {
        position = anchor;
        isOpen = true;
      } else {
        isOpen = false;
        position = null;
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  });

  function handleClose(): void {
    isOpen = false;
    position = null;
  }

  function recordComment(body: string): void {
    lastSubmitted = body;
    handleClose();
  }
</script>

<article
  bind:this={surfaceElement}
  style="max-width: 36rem; line-height: 1.6; user-select: text; cursor: text;"
>
  <p style="margin: 0;">
    Select text in this paragraph to open the comment popover — both mouse drag and keyboard
    selection (hold <kbd>Shift</kbd> while pressing arrow keys, <kbd>Home</kbd>, or <kbd>End</kbd>)
    trigger the popover. Click the comment icon to expand the composer, type a note, then press
    <kbd>Cmd</kbd>+<kbd>Enter</kbd> (macOS) or <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (Windows/Linux) to submit.
    The composer collapses back to the icon after submission — the popover does not stay expanded.
  </p>
</article>

<SelectionPopover
  id={popoverId}
  open={isOpen}
  {position}
  onclose={handleClose}
  oncommentsubmit={recordComment}
/>

{#if lastSubmitted}
  <section style="margin: 1rem 0 0;" aria-label="Last submitted">
    <h3
      style="margin: 0 0 0.5rem; font-size: var(--cinder-text-xs); font-weight: var(--cinder-font-medium); color: var(--cinder-text-muted); text-transform: uppercase; letter-spacing: 0.04em;"
    >
      Last submitted
    </h3>
    <article
      style="padding: 0.5rem 0.75rem; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: var(--cinder-surface);"
    >
      {lastSubmitted}
    </article>
  </section>
{/if}
