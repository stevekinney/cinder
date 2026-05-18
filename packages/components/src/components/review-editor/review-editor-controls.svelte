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
  import Button from '../button.svelte';
  import SegmentedControl, { type SegmentedControlOption } from '../segmented-control.svelte';
  import DiffStatistics from '../diff-statistics.svelte';
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

  const diffViewModeOptions: { value: DiffViewMode; label: string }[] = [
    { value: 'unified', label: 'Unified' },
    { value: 'final', label: 'Final' },
    { value: 'original', label: 'Original' },
  ];

  const viewOptions = $derived.by((): SegmentedControlOption<ViewType>[] => {
    const options: SegmentedControlOption<ViewType>[] = [
      { value: 'editor', label: 'Editor', icon: Pencil, controls: viewPanelIds?.editor },
    ];
    if (showDiffTabs) {
      options.push({ value: 'diff', label: 'Diff', icon: GitBranch, controls: viewPanelIds?.diff });
      options.push({
        value: 'summary',
        label: 'Summary',
        icon: FileText,
        controls: viewPanelIds?.summary,
      });
    }
    return options;
  });

  function handleViewChange(view: ViewType) {
    onViewChange?.(view);
  }

  const commentsToggleLabel = $derived(
    `${sidebarOpen ? 'Close' : 'Open'} comments sidebar (${commentCount} ${
      commentCount === 1 ? 'comment' : 'comments'
    })`,
  );
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
      options={viewOptions}
      onchange={handleViewChange}
    />

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
      aria-label={commentsToggleLabel}
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
   * The toolbar row uses --cinder-control-height-sm (32px) as the shared
   * tier: SegmentedControl + DiffStatistics opt in via density="toolbar",
   * Button (size="sm") already maps there through its alias. No per-instance
   * height overrides are needed below.
   * ========================================================================= */

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
