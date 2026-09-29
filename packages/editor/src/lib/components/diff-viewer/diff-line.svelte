<script lang="ts" module>
  import type { LineDiff } from '@lostgradient/markdown';
  import type { Snippet } from 'svelte';

  import type {
    DiffViewerAnnotationSide,
    DiffViewerLineAnnotationContext,
    DiffViewerMode,
  } from './diff-viewer.types.ts';

  /**
   * One commentable target on this row (COR-514 / DR-4): a `same` row may
   * offer both `old` and `new`, a `modified` row offers both independently
   * (distinct line/text per side), and `added`/`removed` rows offer only the
   * side they exist on.
   */
  export type DiffLineAnnotationTarget = {
    side: DiffViewerAnnotationSide;
    /** Absolute, front-matter-offset-inclusive line number on `side`. */
    line: number;
    /** Unique DOM id for this control -- used for `focusAnchor` and instance isolation. */
    id: string;
    label: string;
    /** True while the diff is stale: creation is disabled, but the row itself still renders. */
    disabled?: boolean | undefined;
    /** Visible explanation shown next to a disabled control. */
    disabledReason?: string | undefined;
    onactivate: (event: MouseEvent) => void;
    onkeydown: (event: KeyboardEvent) => void;
  };

  export type DiffLineProps = {
    /** The line diff data */
    diff: LineDiff;
    /** Current view mode */
    viewMode: DiffViewerMode;
    /** Whether this line is selected */
    selected?: boolean;
    /** Called when user clicks this line (for navigation) */
    onselect?: (() => void) | undefined;
    /** Annotation controls to render for this row's commentable side(s). */
    annotationTargets?: DiffLineAnnotationTarget[] | undefined;
    /** Rendered next to each target's control. */
    lineAnnotation?: Snippet<[DiffViewerLineAnnotationContext]> | undefined;
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
    annotationTargets,
    lineAnnotation,
    class: className,
  }: DiffLineProps = $props();

  function targetForSide(side: DiffViewerAnnotationSide): DiffLineAnnotationTarget | undefined {
    return annotationTargets?.find((target) => target.side === side);
  }

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
  const modifiedOldLineLabel = $derived.by(() =>
    diff.type === 'modified' ? `Removed line: ${diff.oldText || 'blank line'}` : 'Removed line',
  );
  const modifiedNewLineLabel = $derived.by(() =>
    diff.type === 'modified' ? `Added line: ${diff.newText || 'blank line'}` : 'Added line',
  );
  const removedGutter = $derived(viewMode === 'final' ? '' : '-');
  const modifiedSideGutter = $derived(
    viewMode === 'unified' ? '' : viewMode === 'final' ? '+' : '-',
  );
</script>

{#snippet annotationControl(target: DiffLineAnnotationTarget)}
  <button
    type="button"
    id={target.id}
    class="diff-annotation-control"
    data-cinder-annotation-control
    data-cinder-side={target.side}
    data-cinder-line={target.line}
    disabled={target.disabled}
    aria-label={target.label}
    onclick={target.onactivate}
    onkeydown={target.onkeydown}
  >
    +
  </button>
  {#if target.disabled && target.disabledReason}
    <span class="diff-annotation-disabled-hint">{target.disabledReason}</span>
  {/if}
  {#if lineAnnotation}
    {@render lineAnnotation({ side: target.side, line: target.line, diff })}
  {/if}
{/snippet}

{#if isVisible}
  {#if diff.type === 'same'}
    {@const oldTarget = targetForSide('old')}
    {@const newTarget = targetForSide('new')}
    <!-- Same line: static div, not interactive for navigation, but commentable. -->
    <div class={classNames('diff-line', className)}>
      <span class="diff-gutter"></span>
      <span class="diff-text">{diff.text || '\u00A0'}</span>
      {#if oldTarget}{@render annotationControl(oldTarget)}{/if}
      {#if newTarget}{@render annotationControl(newTarget)}{/if}
    </div>
  {:else if diff.type === 'added'}
    <!-- Added line -->
    {@const newTarget = targetForSide('new')}
    {#if isInteractive}
      <span class="diff-row">
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
        {#if newTarget}{@render annotationControl(newTarget)}{/if}
      </span>
    {:else}
      <div
        class={classNames('diff-line diff-line-added', className)}
        data-selected={selected}
        role="group"
        aria-label={accessibleLineLabel}
      >
        <span class="diff-gutter">+</span>
        <span class="diff-text">{diff.text || '\u00A0'}</span>
        {#if newTarget}{@render annotationControl(newTarget)}{/if}
      </div>
    {/if}
  {:else if diff.type === 'removed'}
    <!-- Removed line: strikethrough only in unified view, plain text in original view -->
    {@const showStrikethrough = viewMode === 'unified'}
    {@const oldTarget = targetForSide('old')}
    {#if isInteractive}
      <span class="diff-row">
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
          <span class="diff-gutter">{removedGutter}</span>
          <span class="diff-text">
            {#if showStrikethrough}
              <del>{diff.text || '\u00A0'}</del>
            {:else}
              {diff.text || '\u00A0'}
            {/if}
          </span>
        </button>
        {#if oldTarget}{@render annotationControl(oldTarget)}{/if}
      </span>
    {:else}
      <div
        class={classNames(
          'diff-line',
          showStrikethrough ? 'diff-line-removed' : 'diff-line-removed-original',
          className,
        )}
        data-selected={selected}
        role="group"
        aria-label={accessibleLineLabel}
      >
        <span class="diff-gutter">{removedGutter}</span>
        <span class="diff-text">
          {#if showStrikethrough}
            <del>{diff.text || '\u00A0'}</del>
          {:else}
            {diff.text || '\u00A0'}
          {/if}
        </span>
        {#if oldTarget}{@render annotationControl(oldTarget)}{/if}
      </div>
    {/if}
  {:else if diff.type === 'modified'}
    <!-- Modified line: unified renders paired old/new rows; side modes render one side. -->
    {@const lineClass =
      viewMode === 'unified'
        ? 'diff-line-modified'
        : viewMode === 'final'
          ? 'diff-line-modified-final'
          : 'diff-line-modified-original'}
    {@const displayText =
      viewMode === 'unified' ? null : viewMode === 'final' ? diff.newText : diff.oldText}

    {@const modifiedOldTarget = targetForSide('old')}
    {@const modifiedNewTarget = targetForSide('new')}
    {#if viewMode === 'unified'}
      {#if isInteractive}
        <span class="diff-row">
          <button
            class={classNames('diff-line diff-line-removed', lineClass, className)}
            data-selected={selected}
            aria-label={modifiedOldLineLabel}
            onclick={onselect}
            type="button"
          >
            <span class="diff-gutter">-</span>
            <span class="diff-text"><del>{diff.oldText || '\u00A0'}</del></span>
          </button>
          {#if modifiedOldTarget}{@render annotationControl(modifiedOldTarget)}{/if}
        </span>
        <span class="diff-row">
          <button
            class={classNames('diff-line diff-line-added', lineClass, className)}
            data-selected={selected}
            aria-label={modifiedNewLineLabel}
            onclick={onselect}
            type="button"
          >
            <span class="diff-gutter">+</span>
            <span class="diff-text">{diff.newText || '\u00A0'}</span>
          </button>
          {#if modifiedNewTarget}{@render annotationControl(modifiedNewTarget)}{/if}
        </span>
      {:else}
        <div
          class={classNames('diff-line diff-line-removed', lineClass, className)}
          data-selected={selected}
          role="group"
          aria-label={modifiedOldLineLabel}
        >
          <span class="diff-gutter">-</span>
          <span class="diff-text"><del>{diff.oldText || '\u00A0'}</del></span>
          {#if modifiedOldTarget}{@render annotationControl(modifiedOldTarget)}{/if}
        </div>
        <div
          class={classNames('diff-line diff-line-added', lineClass, className)}
          data-selected={selected}
          role="group"
          aria-label={modifiedNewLineLabel}
        >
          <span class="diff-gutter">+</span>
          <span class="diff-text">{diff.newText || '\u00A0'}</span>
          {#if modifiedNewTarget}{@render annotationControl(modifiedNewTarget)}{/if}
        </div>
      {/if}
    {:else}
      {@const activeSide = viewMode === 'final' ? 'new' : 'old'}
      {@const activeTarget = activeSide === 'new' ? modifiedNewTarget : modifiedOldTarget}
      {#if isInteractive}
        <span class="diff-row">
          <button
            class={classNames('diff-line', lineClass, className)}
            data-selected={selected}
            aria-label={accessibleLineLabel}
            onclick={onselect}
            type="button"
          >
            <span class="diff-gutter">{modifiedSideGutter}</span>
            <span class="diff-text">{displayText || '\u00A0'}</span>
          </button>
          {#if activeTarget}{@render annotationControl(activeTarget)}{/if}
        </span>
      {:else}
        <div
          class={classNames('diff-line', lineClass, className)}
          data-selected={selected}
          role="group"
          aria-label={accessibleLineLabel}
        >
          <span class="diff-gutter">{modifiedSideGutter}</span>
          <span class="diff-text">{displayText || '\u00A0'}</span>
          {#if activeTarget}{@render annotationControl(activeTarget)}{/if}
        </div>
      {/if}
    {/if}
  {/if}
{/if}

<style>
  .diff-line {
    display: flex;
    width: 100%;
    min-height: 1.5em;
  }

  /*
   * A row's `.diff-line` is a real <button> when the existing change-navigation
   * `onselect` is wired, so an annotation control (also a <button>) cannot
   * nest inside it -- nested interactive elements are invalid HTML. `.diff-row`
   * wraps the two as siblings without affecting the row's own layout: it uses
   * `display: contents` so its children lay out exactly as if `.diff-row`
   * were not there, and only exists to give the annotation control a
   * predictable place next to its row.
   */
  .diff-row {
    display: contents;
  }

  .diff-annotation-control {
    flex-shrink: 0;
    width: 1.5rem;
    color: var(--cinder-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: var(--cinder-font-mono);
  }

  .diff-annotation-control:hover:not(:disabled) {
    color: var(--cinder-accent-solid);
  }

  .diff-annotation-control:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .diff-annotation-disabled-hint {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
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
    outline: var(--cinder-ring-width) solid var(--cinder-accent-solid);
    outline-offset: calc(var(--cinder-ring-width) * -1);
    background: color-mix(in oklch, var(--cinder-accent-solid), transparent 90%);
    z-index: 1;
  }

  .diff-gutter {
    flex-shrink: 0;
    width: 1.5rem;
    padding: var(--cinder-space-0-5) 0;
    text-align: center;
    color: var(--cinder-text-muted);
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
    background: var(--cinder-status-success-background);
    text-decoration: underline;
    text-decoration-color: var(--cinder-status-success-solid);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }

  .diff-line-added .diff-gutter {
    color: var(--cinder-status-success-text);
  }

  /* Removed lines */
  .diff-line-removed .diff-text {
    background: var(--cinder-status-danger-background);
  }

  .diff-line-removed .diff-gutter {
    color: var(--cinder-status-danger-text);
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
    color: var(--cinder-text-muted);
  }

  /* Modified lines (unified view) */
  .diff-line-modified .diff-text {
    background: color-mix(in oklch, var(--cinder-status-info-background), transparent 85%);
  }

  .diff-line-modified .diff-gutter {
    color: var(--cinder-status-info-text);
  }

  /* Modified in final view (highlight subtly) */
  .diff-line-modified-final .diff-text {
    background: color-mix(in oklch, var(--cinder-status-info-background), transparent 85%);
  }

  .diff-line-modified-final .diff-gutter {
    color: var(--cinder-status-info-text);
  }

  /* Modified in original view (highlight subtly) */
  .diff-line-modified-original .diff-text {
    background: color-mix(in oklch, var(--cinder-status-info-background), transparent 85%);
  }

  .diff-line-modified-original .diff-gutter {
    color: var(--cinder-status-info-text);
  }
</style>
