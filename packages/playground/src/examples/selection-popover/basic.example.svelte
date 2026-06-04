<script lang="ts" module>
  export const title = 'Selection-driven comment popover';
  export const description =
    'Highlight text in the passage below to trigger the popover at the selection anchor. Position is viewport-relative geometry derived from the selected range.';
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  type Comment = { id: string; body: string };

  const popoverId = 'basic-selection-popover';
  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let comments = $state<Comment[]>([]);

  /**
   * A bound reference to the text surface element.
   * Used in the document-level selectionchange handler to scope
   * selection detection to this element's subtree.
   */
  let surfaceElement = $state<HTMLElement | null>(null);

  /**
   * Compute a viewport-relative anchor from the current Selection.
   * Returns null when there is no non-collapsed selection inside the surface.
   */
  function getSelectionAnchor(surface: HTMLElement): SelectionPopoverPosition | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) return null;

    const rect = range.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };
  }

  /**
   * `selectionchange` fires on document, not on elements.
   * Register at document level and scope to the surface via
   * the bound surfaceElement reference.
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

  function addComment(body: string): void {
    comments = [...comments, { id: crypto.randomUUID(), body }];
    handleClose();
  }
</script>

<article
  bind:this={surfaceElement}
  style="max-width: 36rem; line-height: 1.6; user-select: text; cursor: text;"
>
  <p style="margin: 0 0 0.75rem;">
    The <strong>SelectionPopover</strong> appears near highlighted text — its
    <code>position</code> prop takes viewport-relative coordinates derived from
    <code>Range.getBoundingClientRect()</code>, not local container offsets. Select any portion of
    this paragraph to see it appear above your selection.
  </p>
  <p style="margin: 0;">
    Clicking the comment icon expands the composer. Submit with the send button or
    <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd>. Clicking outside the popover closes it and
    clears the selection state.
  </p>
</article>

<SelectionPopover
  id={popoverId}
  open={isOpen}
  {position}
  onclose={handleClose}
  oncommentsubmit={addComment}
/>

{#if comments.length > 0}
  <section style="margin: 1rem 0 0;" aria-label="Submitted comments">
    <h3
      style="margin: 0 0 0.5rem; font-size: var(--cinder-text-xs); font-weight: var(--cinder-font-medium); color: var(--cinder-text-muted); text-transform: uppercase; letter-spacing: 0.04em;"
    >
      Submitted comments
    </h3>
    {#each comments as comment (comment.id)}
      <article
        style="padding: 0.5rem 0.75rem; margin-bottom: 0.375rem; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: var(--cinder-surface);"
      >
        {comment.body}
      </article>
    {/each}
  </section>
{/if}
