<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { LineDiff, WordChange } from '@lostgradient/cinder/markdown/diff/line-diff';

  import type { DiffViewerMode } from './diff-viewer.types.ts';

  export type DiffLineProps = {
    /** The line diff data */
    diff: LineDiff;
    /** Current view mode */
    viewMode: DiffViewerMode;
    /** Whether this line is selected */
    selected?: boolean;
    /** Called when user clicks this line (for navigation) */
    onselect?: (() => void) | undefined;
    /** Optional: custom word change renderer */
    wordChangeRenderer?: Snippet<[{ changes: WordChange[] }]> | undefined;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  let {
    diff,
    viewMode,
    selected = false,
    onselect,
    wordChangeRenderer,
    class: className,
  }: DiffLineProps = $props();

  /**
   * Whether this line should be visible based on view mode.
   * - Unified: show all line types
   * - Final: hide 'removed' lines (show current state)
   * - Original: hide 'added' lines (show baseline)
   */
  const isVisible = $derived.by(() => {
    if (diff.type === 'same') return true;
    if (viewMode === 'unified') return true;
    if (viewMode === 'final') return diff.type !== 'removed';
    if (viewMode === 'original') return diff.type !== 'added';
    return true;
  });

  /**
   * Whether this line is interactive (clickable for selection).
   * Same lines are not selectable.
   */
  const isInteractive = $derived(diff.type !== 'same' && onselect !== undefined);
  const accessibleLineLabel = $derived.by(() => {
    const text =
      diff.type === 'modified'
        ? viewMode === 'original'
          ? diff.oldText
          : viewMode === 'final'
            ? diff.newText
            : `${diff.oldText} changed to ${diff.newText}`
        : diff.text;
    const typeLabel =
      diff.type === 'added'
        ? 'Added line'
        : diff.type === 'removed'
          ? 'Removed line'
          : 'Modified line';
    return `${typeLabel}: ${text || 'blank line'}`;
  });
</script>

{#if isVisible}
  {#if diff.type === 'same'}
    <!-- Same line: static div, not interactive -->
    <div class={classNames('diff-line', className)}>
      <span class="diff-gutter"></span>
      <span class="diff-text">{diff.text || '\u00A0'}</span>
    </div>
  {:else if diff.type === 'added'}
    <!-- Added line -->
    {#if isInteractive}
      <button
        class={classNames('diff-line diff-line-added', className)}
        data-selected={selected}
        aria-label={accessibleLineLabel}
        onclick={onselect}
        type="button"
      >
        <span class="diff-gutter">+</span>
        <span class="diff-text">{diff.text || '\u00A0'}</span>
      </button>
    {:else}
      <div class={classNames('diff-line diff-line-added', className)} data-selected={selected}>
        <span class="diff-gutter">+</span>
        <span class="diff-text">{diff.text || '\u00A0'}</span>
      </div>
    {/if}
  {:else if diff.type === 'removed'}
    <!-- Removed line: strikethrough only in unified view, plain text in original view -->
    {@const showStrikethrough = viewMode === 'unified'}
    {#if isInteractive}
      <button
        class={classNames(
          'diff-line',
          showStrikethrough ? 'diff-line-removed' : 'diff-line-removed-original',
          className,
        )}
        data-selected={selected}
        aria-label={accessibleLineLabel}
        onclick={onselect}
        type="button"
      >
        <span class="diff-gutter">{showStrikethrough ? '-' : ''}</span>
        <span class="diff-text">
          {#if showStrikethrough}
            <del>{diff.text || '\u00A0'}</del>
          {:else}
            {diff.text || '\u00A0'}
          {/if}
        </span>
      </button>
    {:else}
      <div
        class={classNames(
          'diff-line',
          showStrikethrough ? 'diff-line-removed' : 'diff-line-removed-original',
          className,
        )}
        data-selected={selected}
      >
        <span class="diff-gutter">{showStrikethrough ? '-' : ''}</span>
        <span class="diff-text">
          {#if showStrikethrough}
            <del>{diff.text || '\u00A0'}</del>
          {:else}
            {diff.text || '\u00A0'}
          {/if}
        </span>
      </div>
    {/if}
  {:else if diff.type === 'modified'}
    <!-- Modified line: rendering depends on view mode -->
    {@const lineClass =
      viewMode === 'unified'
        ? 'diff-line-modified'
        : viewMode === 'final'
          ? 'diff-line-modified-final'
          : 'diff-line-modified-original'}
    {@const displayText =
      viewMode === 'unified' ? null : viewMode === 'final' ? diff.newText : diff.oldText}

    {#if isInteractive}
      <button
        class={classNames('diff-line', lineClass, className)}
        data-selected={selected}
        aria-label={accessibleLineLabel}
        onclick={onselect}
        type="button"
      >
        <span class="diff-gutter">~</span>
        <span class="diff-text">
          {#if viewMode === 'unified'}
            <!-- Unified: show word-level changes -->
            {#if wordChangeRenderer}
              {@render wordChangeRenderer({ changes: diff.wordChanges })}
            {:else}
              <span class="word-changes">
                {#each diff.wordChanges as wordChange, widx (`${widx}:${wordChange.type}:${wordChange.text}`)}
                  {#if wordChange.type === 'same'}
                    <span>{wordChange.text}</span>
                  {:else if wordChange.type === 'removed'}
                    <del class="word-removed">{wordChange.text}</del>
                  {:else if wordChange.type === 'added'}
                    <ins class="word-added">{wordChange.text}</ins>
                  {/if}
                {/each}
              </span>
            {/if}
          {:else}
            <!-- Final/Original: show single text -->
            {displayText || '\u00A0'}
          {/if}
        </span>
      </button>
    {:else}
      <div class={classNames('diff-line', lineClass, className)} data-selected={selected}>
        <span class="diff-gutter">~</span>
        <span class="diff-text">
          {#if viewMode === 'unified'}
            {#if wordChangeRenderer}
              {@render wordChangeRenderer({ changes: diff.wordChanges })}
            {:else}
              <span class="word-changes">
                {#each diff.wordChanges as wordChange, widx (`${widx}:${wordChange.type}:${wordChange.text}`)}
                  {#if wordChange.type === 'same'}
                    <span>{wordChange.text}</span>
                  {:else if wordChange.type === 'removed'}
                    <del class="word-removed">{wordChange.text}</del>
                  {:else if wordChange.type === 'added'}
                    <ins class="word-added">{wordChange.text}</ins>
                  {/if}
                {/each}
              </span>
            {/if}
          {:else}
            {displayText || '\u00A0'}
          {/if}
        </span>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .diff-line {
    display: flex;
    width: 100%;
    min-height: 1.5em;
  }

  button.diff-line {
    all: unset;
    display: flex;
    width: 100%;
    min-height: 1.5em;
    cursor: pointer;
    box-sizing: border-box;
  }

  /* Each diff line is a full-bleed row inside the scrollable viewer; an outset
     ring is clipped at the row edges, so paint an INSET ring (Strategy B-inset). */
  button.diff-line:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-diff-line-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    button.diff-line:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .diff-line[data-selected='true'] {
    outline: var(--cinder-ring-width) solid var(--cinder-accent);
    outline-offset: calc(var(--cinder-ring-width) * -1);
    background: color-mix(in oklch, var(--cinder-accent), transparent 90%);
    z-index: 1;
  }

  .diff-gutter {
    flex-shrink: 0;
    width: 2rem;
    padding: var(--cinder-space-0-5) var(--cinder-space-2);
    text-align: center;
    color: var(--cinder-text-muted);
    background: var(--cinder-surface-inset);
    border-inline-end: 1px solid var(--cinder-border);
    user-select: none;
    font-weight: var(--cinder-font-medium);
  }

  .diff-text {
    flex: 1;
    padding: var(--cinder-space-0-5) var(--cinder-space-3);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* Added lines (DEP-47: underline provides non-color indicator for a11y) */
  .diff-line-added .diff-text {
    background: var(--cinder-color-success-bg);
    text-decoration: underline;
    text-decoration-color: var(--cinder-success);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }

  .diff-line-added .diff-gutter {
    background: var(--cinder-color-success-border);
    color: var(--cinder-color-success-fg);
  }

  /* Removed lines */
  .diff-line-removed .diff-text {
    background: var(--cinder-color-danger-bg);
  }

  .diff-line-removed .diff-gutter {
    background: var(--cinder-color-danger-border);
    color: var(--cinder-color-danger-fg);
  }

  .diff-line-removed del {
    text-decoration: line-through;
    opacity: 0.8;
  }

  /* Removed lines in original view: render as plain text (baseline content) */
  .diff-line-removed-original .diff-text {
    background: transparent;
  }

  .diff-line-removed-original .diff-gutter {
    background: var(--cinder-surface-inset);
    color: var(--cinder-text-muted);
  }

  /* Modified lines (unified view) */
  .diff-line-modified .diff-text {
    background: color-mix(in oklch, var(--cinder-color-info-bg), transparent 85%);
  }

  .diff-line-modified .diff-gutter {
    background: color-mix(in oklch, var(--cinder-color-info-bg), transparent 60%);
    color: var(--cinder-color-info-fg);
  }

  .word-changes {
    display: inline;
  }

  .word-removed {
    background: var(--cinder-color-danger-bg);
    color: var(--cinder-color-danger-fg);
    text-decoration: line-through;
    border-radius: 2px;
    padding: 0 2px;
    box-shadow: inset 0 0 0 1px var(--cinder-color-danger-border);
  }

  /* DEP-47: underline provides non-color indicator for a11y */
  .word-added {
    background: var(--cinder-color-success-bg);
    color: var(--cinder-color-success-fg);
    text-decoration: underline;
    text-decoration-color: var(--cinder-success);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    border-radius: 2px;
    padding: 0 2px;
    box-shadow: inset 0 0 0 1px var(--cinder-color-success-border);
  }

  /* Modified in final view (highlight subtly) */
  .diff-line-modified-final .diff-text {
    background: color-mix(in oklch, var(--cinder-color-info-bg), transparent 85%);
  }

  .diff-line-modified-final .diff-gutter {
    background: color-mix(in oklch, var(--cinder-color-info-bg), transparent 65%);
    color: var(--cinder-color-info-fg);
  }

  /* Modified in original view (highlight subtly) */
  .diff-line-modified-original .diff-text {
    background: color-mix(in oklch, var(--cinder-color-info-bg), transparent 85%);
  }

  .diff-line-modified-original .diff-gutter {
    background: color-mix(in oklch, var(--cinder-color-info-bg), transparent 65%);
    color: var(--cinder-color-info-fg);
  }
</style>
