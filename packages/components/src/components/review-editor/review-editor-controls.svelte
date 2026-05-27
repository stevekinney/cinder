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
    /** Panel IDs controlled by each top-level view option. */
    viewPanelIds?: Partial<Record<ViewType, string>>;
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
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import Segment from '../segment/segment.svelte';
  import SegmentedControl from '../segmented-control/segmented-control.svelte';
  import DiffStatistics from '../diff-statistics/diff-statistics.svelte';
  import { FileText, GitBranch, MessageSquare, Pencil, RotateCcw } from '../icons/index.ts';

  let {
    id,
    activeView,
    viewPanelIds,
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

  function handleViewChange(view: ViewType) {
    onViewChange?.(view);
  }

  const commentsToggleLabel = $derived(
    `${sidebarOpen ? 'Close' : 'Open'} comments sidebar (${commentCount} ${
      commentCount === 1 ? 'comment' : 'comments'
    })`,
  );

  // Live announcer for comment count changes.
  let previousCommentCount = $state<number | null>(null);
  let liveAnnouncementText = $state('');

  // This effect writes to the same $state it reads (previousCommentCount), which
  // would normally loop. It does not: each run sets previousCommentCount equal
  // to commentCount, so the re-run triggered by that write hits the
  // `commentCount === previousCommentCount` guard and exits without writing
  // again. Keep that invariant if you edit this — only write when the values
  // differ.
  $effect(() => {
    // Do not announce on initial render — only on subsequent changes.
    if (previousCommentCount === null) {
      previousCommentCount = commentCount;
      return;
    }
    if (commentCount !== previousCommentCount) {
      previousCommentCount = commentCount;
      liveAnnouncementText = `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`;
    }
  });
</script>

<div
  {id}
  class={classNames('review-editor-controls', className)}
  role="toolbar"
  aria-label="Review editor controls"
>
  <div class="controls-leading">
    <SegmentedControl
      id="{id}-view-mode"
      label="Review editor view"
      hideLabel
      variant="tablist"
      size="sm"
      density="toolbar"
      value={activeView}
      onchange={handleViewChange}
    >
      <Segment value="editor" controls={viewPanelIds?.editor}>
        {#snippet leading()}<Pencil class="icon-xs" />{/snippet}
        Editor
      </Segment>
      {#if showDiffTabs}
        <Segment value="diff" controls={viewPanelIds?.diff}>
          {#snippet leading()}<GitBranch class="icon-xs" />{/snippet}
          Diff
        </Segment>
        <Segment value="summary" controls={viewPanelIds?.summary}>
          {#snippet leading()}<FileText class="icon-xs" />{/snippet}
          Summary
        </Segment>
      {/if}
    </SegmentedControl>

    {#if diffStats && (diffStats.added > 0 || diffStats.removed > 0 || diffStats.modified > 0)}
      <DiffStatistics
        variant="compact"
        density="toolbar"
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
        selectionMode="single"
        size="sm"
        density="toolbar"
        label="Diff view mode"
        hideLabel
        bind:value={diffViewMode}
      >
        <Segment value="unified">Unified</Segment>
        <Segment value="final">Final</Segment>
        <Segment value="original">Original</Segment>
      </SegmentedControl>
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

    <div class="comments-toggle-wrapper">
      <Button
        variant="ghost"
        size="sm"
        onclick={onSidebarToggle}
        aria-expanded={sidebarOpen}
        aria-controls="{id}-sidebar"
        aria-label={commentsToggleLabel}
        title={sidebarOpen ? 'Close comments sidebar' : 'Open comments sidebar'}
      >
        <MessageSquare class="icon-sm" />
        <Badge aria-hidden="true" size="sm" variant="neutral">{commentCount}</Badge>
      </Button>
    </div>

    {#if trailing}
      {@render trailing()}
    {/if}
  </div>
</div>

<!-- Polite live announcer for comment count changes. Empty on initial render. -->
<div role="status" aria-live="polite" aria-atomic="true" class="comments-count-announcer sr-only">
  {liveAnnouncementText}
</div>

<style>
  .review-editor-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1) var(--cinder-space-2);
    /* Background inherited from .review-editor-container per surface nesting rule. */
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
   * The toolbar row uses --cinder-control-height-sm (32px) as the shared
   * tier: SegmentedControl + DiffStatistics opt in via density="toolbar",
   * Button (size="sm") already maps there through its alias. SegmentedControl's
   * density="toolbar" pins min-block-size to that tier while delegating font
   * and inline padding to its compact `sm` rule, so the toolbar row stays
   * aligned without requiring per-instance height overrides below.
   * ========================================================================= */

  /* Comments toggle button with badge — locally scoped via the wrapper. */
  .comments-toggle-wrapper :global(.cinder-button) {
    gap: var(--cinder-space-1);
  }
</style>
