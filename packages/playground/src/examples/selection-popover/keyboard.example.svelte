<script lang="ts" module>
  export const title = 'Keyboard submit';
  export const description =
    'Press Cmd+Enter (or Ctrl+Enter) inside the composer to submit. The composer should collapse back to the icon after each submission.';
</script>

<script lang="ts">
  import { SelectionPopover } from 'cinder/selection-popover';

  let lastSubmitted = $state<string | null>(null);

  function recordComment(body: string): void {
    lastSubmitted = body;
  }
</script>

<div style="position: relative; min-height: 9rem;">
  <p style="max-width: 36rem; margin: 0;">
    Open the composer, type a comment, and press <kbd>Cmd</kbd>+<kbd>Enter</kbd> (or
    <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) to submit. The popover should collapse back to the icon — if
    it stays expanded, the keyboard-submit regression has returned.
  </p>

  <SelectionPopover
    id="keyboard-selection-popover"
    open
    position={{ x: 180, y: 96 }}
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
</div>
