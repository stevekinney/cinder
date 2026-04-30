<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type {
    ReviewEditorDiffViewMode as DiffViewMode,
    ReviewEditorViewType as ViewType,
  } from './review-editor-types.ts';

  export type ReviewEditorControlsProps = {
    /** Unique ID for accessibility */
    id: string;
    /** Current active view */
    activeView: ViewType;
    /** Callback when view changes */
    onViewChange?: (view: ViewType) => void;
    /** Whether to show diff/summary tabs */
    showDiffTabs?: boolean;
    /** Diff statistics */
    diffStats?: { added: number; removed: number; modified: number };
    /** Current diff view mode (only shown in diff view). Supports bind:diffViewMode. */
    diffViewMode?: DiffViewMode;
    /** Whether there are content changes (for Revert All) */
    hasContentChanges?: boolean;
    /** Whether editor is readonly */
    readonly?: boolean;
    /** Callback for Revert All action */
    onRevertAll?: () => void;
    /** Comment count */
    commentCount?: number;
    /** Whether sidebar is open */
    sidebarOpen?: boolean;
    /** Callback for sidebar toggle */
    onSidebarToggle?: () => void;
    /** Trailing actions snippet (e.g., export menu) */
    trailing?: Snippet;
    /** Additional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Button from '../button.svelte';
  import SegmentedControl from '../segmented-control.svelte';
  import ViewSwitcher from '../view-switcher.svelte';
  import DiffStatistics from '../diff-statistics.svelte';
  import { MessageSquare, RotateCcw } from '../icons/index.ts';

  let {
    id,
    activeView,
    onViewChange,
    showDiffTabs = true,
    diffStats,
    diffViewMode = $bindable<DiffViewMode>('unified'),
    hasContentChanges = false,
    readonly = false,
    onRevertAll,
    commentCount = 0,
    sidebarOpen = false,
    onSidebarToggle,
    trailing,
    class: className,
  }: ReviewEditorControlsProps = $props();

  const diffViewModeOptions: { value: DiffViewMode; label: string }[] = [
    { value: 'unified', label: 'Unified' },
    { value: 'final', label: 'Final' },
    { value: 'original', label: 'Original' },
  ];

  function handleViewChange(view: ViewType) {
    onViewChange?.(view);
  }
</script>

<div
  {id}
  class={classNames('review-editor-controls', className)}
  role="toolbar"
  aria-label="Review editor controls"
>
  <div class="controls-leading">
    <ViewSwitcher
      id="{id}-view-switcher"
      value={activeView}
      showDiff={showDiffTabs}
      showSummary={showDiffTabs}
      onchange={(view: ViewType) => handleViewChange(view)}
    />

    {#if diffStats && (diffStats.added > 0 || diffStats.removed > 0 || diffStats.modified > 0)}
      <DiffStatistics
        variant="compact"
        added={diffStats.added}
        removed={diffStats.removed}
        modified={diffStats.modified}
        hideZero
      />
    {/if}

    {#if activeView === 'diff'}
      <div class="controls-separator" aria-hidden="true"></div>
      <SegmentedControl
        id="{id}-diff-view-mode"
        label="Diff view mode"
        hideLabel
        bind:value={diffViewMode}
        options={diffViewModeOptions}
      />
    {/if}
  </div>

  <div class="controls-trailing">
    {#if activeView === 'diff' && hasContentChanges && !readonly}
      <Button
        variant="ghost"
        size="sm"
        onclick={onRevertAll}
        aria-label="Revert all changes"
        title="Revert all changes"
      >
        <RotateCcw class="icon-sm" />
        <span class="sr-only">Revert All</span>
      </Button>
    {/if}

    <Button
      variant="ghost"
      size="sm"
      class="comments-toggle"
      onclick={onSidebarToggle}
      aria-expanded={sidebarOpen}
      aria-controls="{id}-sidebar"
      title={sidebarOpen ? 'Close comments sidebar' : 'Open comments sidebar'}
    >
      <MessageSquare class="icon-sm" />
      <span class="comments-count">{commentCount}</span>
    </Button>

    {#if trailing}
      {@render trailing()}
    {/if}
  </div>
</div>

<style>
  .review-editor-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1) var(--cinder-space-2);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md) var(--cinder-radius-md) 0 0;
    border-bottom: none;
    min-height: 2.5rem;
    flex-wrap: wrap;
  }

  .controls-leading {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    flex-wrap: wrap;
  }

  .controls-trailing {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    flex-wrap: wrap;
  }

  .controls-separator {
    width: 1px;
    height: 1rem;
    background: var(--cinder-border);
    flex-shrink: 0;
  }

  /* =========================================================================
   * Unified control heights
   * All controls in the toolbar should have consistent visual height
   * Target: 24px outer height for all interactive elements
   * ========================================================================= */

  /* ViewSwitcher wrapper - ensure consistent outer height */
  .review-editor-controls :global(.view-switcher) {
    padding: 2px;
  }

  /* ViewSwitcher tabs - 20px inner height (24px with wrapper padding) */
  .review-editor-controls :global(.view-switcher-tab) {
    height: 20px;
    min-height: 20px;
    padding: 0 var(--cinder-space-2);
    line-height: 1;
  }

  /* SegmentedControl wrapper - ensure consistent outer height */
  .review-editor-controls :global(.segmented-control) {
    padding: 2px;
  }

  /* SegmentedControl options - 20px inner height (24px with wrapper padding + border) */
  .review-editor-controls :global(.segmented-control-option) {
    height: 18px;
    min-height: 18px;
    padding: 0 var(--cinder-space-2);
  }

  /* Buttons - 24px height to match */
  .review-editor-controls :global(.button[data-size='sm']) {
    height: 24px;
    min-height: 24px;
    padding: 0 var(--cinder-space-2);
  }

  /* Comments toggle button with count */
  :global(.comments-toggle) {
    gap: var(--cinder-space-1);
  }

  .comments-count {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    min-width: 1rem;
    text-align: center;
  }
</style>
