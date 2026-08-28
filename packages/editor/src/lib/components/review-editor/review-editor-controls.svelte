<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type {
    ReviewEditorDiffViewMode as DiffViewMode,
    ReviewEditorViewType as ViewType,
  } from './review-editor.types.ts';

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
    /**
     * ID of the comments sidebar the comments toggle controls.
     *
     * Required, and deliberately not defaulted: this component is instantiated
     * with its own `id` (`{editorId}-controls`), so any fallback derived from
     * `id` yields `{editorId}-controls-sidebar` and points `aria-controls` at
     * an element that never exists. Making it required means a caller that
     * forgets it fails to typecheck instead of silently shipping a dangling
     * reference.
     */
    sidebarId: string;
    /** Whether sidebar is open */
    sidebarOpen?: boolean;
    /** Callback for sidebar toggle */
    onSidebarToggle?: () => void;
    /**
     * Formatting controls, rendered inline after the view switcher.
     *
     * The editor's formatting toolbar lives here rather than in a second bar
     * below: the diff and summary views already fold their controls into this
     * one, and a stacked pair cost ~90px of chrome before any document.
     */
    formatting?: Snippet | undefined;
    /** Trailing actions snippet (e.g., export menu) */
    trailing?: Snippet;
    /** Additional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '@lostgradient/cinder/badge';
  import Button from '@lostgradient/cinder/button';
  import Segment from '@lostgradient/cinder/segment';
  import SegmentedControl from '@lostgradient/cinder/segmented-control';
  import DiffStatistics from '@lostgradient/cinder/diff-statistics';
  import Toolbar from '@lostgradient/cinder/toolbar';
  import {
    FileText,
    GitBranch,
    MessageSquare,
    Pencil,
    RotateCcw,
  } from '@lostgradient/cinder/icons';

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
    sidebarId,
    sidebarOpen = false,
    onSidebarToggle,
    formatting,
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

<!--
  `group`, not `toolbar`: this bar is a container of control groups rather than
  a flat set of toolbar widgets. It holds a `tablist` (never a valid child of
  `toolbar`) and, in the editor view, the editor's own `toolbar` — and a
  `toolbar` inside a `toolbar` is not a valid nesting either. `group` with a
  label describes what this actually is and keeps the children valid.
-->
<div
  {id}
  class={classNames('review-editor-controls', className)}
  role="group"
  aria-label="Review editor controls"
>
  <div class="controls-leading">
    <SegmentedControl
      id="{id}-view-mode"
      label="Review editor view"
      labelVisible={false}
      variant="tablist"
      size="sm"
      density="toolbar"
      value={activeView}
      onValueChange={handleViewChange}
    >
      <!--
        `controls` is only passed for the ACTIVE segment (cinder#1303). The view
        area below renders exactly one panel at a time via an `{#if}` chain — the
        other two views' panels are not in the document at all, not merely
        hidden — so an inactive tab's `aria-controls` would point at an id that
        does not exist. A dangling id reference is worse than an absent one: it
        fails "every IDREF resolves" (axe's aria-valid-attr-value, and any
        screen reader that follows the tab-to-panel relationship), where
        omitting `controls` on the inactive tabs is simply a tab that doesn't
        (yet) claim to control anything.
      -->
      <Segment value="editor" controls={activeView === 'editor' ? viewPanelIds?.editor : undefined}>
        {#snippet leading()}<Pencil class="cinder-icon-xs" />{/snippet}
        Editor
      </Segment>
      {#if showDiffTabs}
        <Segment value="diff" controls={activeView === 'diff' ? viewPanelIds?.diff : undefined}>
          {#snippet leading()}<GitBranch class="cinder-icon-xs" />{/snippet}
          Diff
        </Segment>
        <Segment
          value="summary"
          controls={activeView === 'summary' ? viewPanelIds?.summary : undefined}
        >
          {#snippet leading()}<FileText class="cinder-icon-xs" />{/snippet}
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
        zeroVisible={false}
      />
    {/if}

    {#if formatting}
      <div class="controls-separator" aria-hidden="true"></div>
      <div class="controls-formatting">
        {@render formatting()}
      </div>
    {/if}

    {#if activeView === 'diff'}
      <div class="controls-separator" aria-hidden="true"></div>
      <!--
        `SegmentedControl` here has no `variant="tablist"`, so it defaults to
        `variant="radiogroup"` (see segmented-control.svelte) — a `radiogroup`,
        unlike a `tablist`, is not forbidden inside `toolbar`. Its own segments
        already carry a roving tabindex (only the active one is tabbable), so
        `<Toolbar>` sees a single focusable item here and defers arrow-key
        handling to the radiogroup's own handler — matching how
        `@lostgradient/cinder/toolbar`'s own "Toolbar with groups" example
        wraps a SegmentedControl.
      -->
      <Toolbar aria-label="Diff view controls">
        <SegmentedControl
          id="{id}-diff-view-mode"
          selectionMode="single"
          size="sm"
          density="toolbar"
          label="Diff view mode"
          labelVisible={false}
          bind:value={diffViewMode}
        >
          <Segment value="unified">Unified</Segment>
          <Segment value="final">Final</Segment>
          <Segment value="original">Original</Segment>
        </SegmentedControl>
      </Toolbar>
    {/if}
  </div>

  <!--
    NOT wrapped in `<Toolbar>`, though it would be ARIA-valid to do so — none of
    these controls is a tablist or a nested toolbar.

    An earlier pass attributed this to a `<Toolbar>` defect, claiming a leading
    `{#if}` child silently drops every following sibling. That claim was tested
    directly and does NOT reproduce: a `<Toolbar>` with a leading `{#if}` renders
    all its siblings with the condition either true or false, and `Toolbar` only
    does `{@render children()}` plus a MutationObserver for focus tracking — it
    never moves or removes nodes. No upstream bug was filed, because there is no
    evidence of one.

    So this cluster stays in ordinary Tab order by choice, not by workaround.
    Roving tabindex would buy little here: these are three unrelated actions
    (revert, comments toggle, export), not a homogeneous control group a user
    arrows through. If someone does want `Toolbar` semantics here later, start
    from a fresh reproduction rather than this note.
  -->
  <div class="controls-trailing">
    {#if activeView === 'diff' && hasContentChanges && !readonly}
      <Button
        variant="ghost"
        size="sm"
        onclick={onRevertAll}
        aria-label="Revert all changes"
        title="Revert all changes"
      >
        <RotateCcw class="cinder-icon-sm" />
        <span class="cinder-sr-only">Revert All</span>
      </Button>
    {/if}

    <div class="comments-toggle-wrapper">
      <Button
        variant="ghost"
        size="sm"
        id={`${sidebarId}-toggle`}
        onclick={onSidebarToggle}
        aria-expanded={sidebarOpen}
        aria-controls={sidebarId}
        aria-label={commentsToggleLabel}
        title={sidebarOpen ? 'Close comments sidebar' : 'Open comments sidebar'}
      >
        <MessageSquare class="cinder-icon-sm" />
        <Badge aria-hidden="true" size="sm" variant="neutral">{commentCount}</Badge>
      </Button>
    </div>

    {#if trailing}
      {@render trailing()}
    {/if}
  </div>
</div>

<!-- Polite live announcer for comment count changes. Empty on initial render. -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="comments-count-announcer cinder-sr-only"
>
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
    flex-wrap: nowrap;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .controls-leading {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    flex-wrap: nowrap;
    flex: 0 0 auto;
  }

  .controls-trailing {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    flex-wrap: nowrap;
    flex: 0 0 auto;
  }

  /* The hosted formatting toolbar sheds its standalone chrome — it is a group
     inside this bar now, not a bar of its own. */
  .controls-formatting {
    display: flex;
    align-items: center;
    /* Hold intrinsic width: the parent row is `flex-wrap: nowrap` with an
       auto-scrolling overflow, so a shrinkable child collapses to 0 instead
       of pushing the row into its scroll region. */
    flex: 0 0 auto;
  }

  .controls-formatting :global(.editor-toolbar) {
    border: none;
    border-radius: 0;
    background: none;
    padding: 0;
    min-block-size: auto;
    flex: 0 0 auto;
    overflow: visible;
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
