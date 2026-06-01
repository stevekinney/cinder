<script lang="ts" module>
  export const title = 'Keyboard submit after selection';
  export const description =
    'Select text to open the composer, then press Cmd+Enter or Ctrl+Enter to submit. The composer collapses back to the icon — the popover does not stay expanded.';
</script>

<script lang="ts">
  import type { SelectionPopoverPosition } from 'cinder/selection-popover';
  import { SelectionPopover } from 'cinder/selection-popover';

  const popoverId = 'keyboard-selection-popover';
  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let lastSubmitted = $state<string | null>(null);

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

  function handleSelectionChange(event: Event): void {
    const surface = event.currentTarget as HTMLElement;
    const anchor = getSelectionAnchor(surface);
    if (anchor) {
      position = anchor;
      isOpen = true;
    } else {
      isOpen = false;
      position = null;
    }
  }

  function handleClose(): void {
    isOpen = false;
    position = null;
  }

  function recordComment(body: string): void {
    lastSubmitted = body;
    handleClose();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
  style="max-width: 36rem; line-height: 1.6; user-select: text; cursor: text;"
  onselectionchange={handleSelectionChange}
>
  <p style="margin: 0;">
    Select text in this paragraph to open the comment popover. Click the comment icon to expand the
    composer, type a note, then press <kbd>Cmd</kbd>+<kbd>Enter</kbd> (macOS) or
    <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (Windows/Linux) to submit. The composer collapses back to the icon
    after submission — the popover does not stay expanded.
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
