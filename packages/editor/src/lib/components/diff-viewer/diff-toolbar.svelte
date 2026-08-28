<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { LineDiffStats } from '@lostgradient/markdown/diff/line-diff';
  import type { DiffState, DiffTier } from './diff-controller.svelte';

  import type { DiffViewerMode } from './diff-viewer.types.ts';

  export type DiffToolbarProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /**
     * Base id for this toolbar's internal ids (currently the view-mode
     * segmented control and its label). Optional: when omitted, a stable id
     * is generated via `$props.id()`, matching Checkbox/Input and the rest of
     * the package's id-generation convention. Provide it when a consumer
     * mounts more than one `DiffToolbar`-bearing `DiffViewer` on the same
     * page and needs a known, stable id to reference — cinder#1309.
     */
    id?: string;
    /** Current view mode (bindable) */
    viewMode?: DiffViewerMode;
    /** Diff statistics */
    stats: LineDiffStats;
    /** Number of navigable changes */
    changeCount: number;
    /** Current position in change navigation (0-based, -1 if none selected) */
    currentChangeIndex: number;
    /** Whether there are any changes (body or front matter) */
    hasChanges: boolean;
    /** Whether the viewer is read-only (hides revert buttons) */
    readonly?: boolean;
    /** Diff computation state for size-based gating UI */
    diffState?: Pick<DiffState, 'tier' | 'isStale' | 'isComputing' | 'warning' | 'lastComputeTime'>;
    /** Called when user clicks next change */
    onjumpnext?: (() => void) | undefined;
    /** Called when user clicks previous change */
    onjumpprevious?: (() => void) | undefined;
    /** Called when user wants to revert all changes */
    onrevertall?: (() => void) | undefined;
    /** Called when user triggers manual diff compute (for large docs) */
    ontriggercompute?: (() => void) | undefined;
    /** Copy the current comparison as a complete unified diff. */
    oncopydiff?: (() => void) | undefined;
    /** Additional toolbar actions rendered in the right section */
    actions?: Snippet;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '@lostgradient/cinder/badge';
  import Button from '@lostgradient/cinder/button';
  import Kbd from '@lostgradient/cinder/kbd';
  import Segment from '@lostgradient/cinder/segment';
  import SegmentedControl from '@lostgradient/cinder/segmented-control';
  import Spinner from '@lostgradient/cinder/spinner';
  import {
    ChevronLeft,
    ChevronRight,
    Copy,
    RefreshCw,
    RotateCcw,
  } from '@lostgradient/cinder/icons';

  let {
    id,
    viewMode = $bindable<DiffViewerMode>('unified'),
    stats,
    changeCount,
    currentChangeIndex,
    hasChanges,
    readonly = false,
    diffState,
    onjumpnext,
    onjumpprevious,
    onrevertall,
    ontriggercompute,
    oncopydiff,
    actions,
    class: className,
    ...rest
  }: DiffToolbarProps = $props();

  // Default diffState values if not provided
  const tier = $derived<DiffTier>(diffState?.tier ?? 'realtime');
  const isStale = $derived(diffState?.isStale ?? false);
  const isComputing = $derived(diffState?.isComputing ?? false);

  // Per-instance id for the view-mode control, matching the rest of the
  // package's convention (Checkbox, Tabs, Dropdown, …): an explicit `id` prop
  // wins, otherwise fall back to Svelte's SSR-stable `$props.id()`. Previously
  // this was the literal "diff-view-mode" on every instance, which collided
  // across multiple `DiffViewer`s on one page — `SegmentedControl` derives its
  // label id as `${id}-label`, so every instance's `aria-labelledby` resolved
  // to the FIRST instance's label via `getElementById` (cinder#1309).
  const generatedId = $props.id();
  const resolvedViewModeId = $derived(id ?? generatedId);
</script>

<div class={classNames('diff-toolbar', className)} {...rest}>
  <div class="toolbar-left">
    <SegmentedControl
      id={resolvedViewModeId}
      selectionMode="single"
      size="sm"
      label="View mode"
      labelVisible={false}
      bind:value={viewMode}
    >
      <Segment value="unified">Unified</Segment>
      <Segment value="final">Final</Segment>
      <Segment value="original">Original</Segment>
    </SegmentedControl>
    <div class="stats">
      {#if stats.added > 0}
        <Badge variant="success" size="xs" class="stat-badge">+{stats.added}</Badge>
      {/if}
      {#if stats.removed > 0}
        <Badge variant="danger" size="xs" class="stat-badge">-{stats.removed}</Badge>
      {/if}
      {#if stats.modified > 0}
        <Badge variant="accent" size="xs" class="stat-badge">~{stats.modified}</Badge>
      {/if}
      {#if stats.added === 0 && stats.removed === 0 && stats.modified === 0}
        <span class="no-changes">No changes</span>
      {/if}
      <!-- Stale/Computing indicators (DEP-47) -->
      {#if isStale}
        <Badge variant="warning" size="xs" class="stat-badge">Outdated</Badge>
      {/if}
      {#if isComputing}
        <Spinner size="sm" />
      {/if}
    </div>
  </div>

  <div class="toolbar-right">
    <!-- Custom toolbar actions (injected by parent) -->
    {#if actions}
      {@render actions()}
    {/if}

    {#if oncopydiff && hasChanges}
      <Button variant="ghost" size="xs" onclick={oncopydiff} aria-label="Copy unified diff">
        <Copy class="cinder-icon-sm" />
        Copy diff
      </Button>
    {/if}

    <!-- Revert All button -->
    {#if hasChanges && !readonly && onrevertall}
      <Button variant="secondary" size="xs" onclick={onrevertall}>
        <RotateCcw class="cinder-icon-sm" />
        Revert All
      </Button>
    {/if}

    <!-- Size-based gating controls (DEP-47) -->
    {#if tier === 'manual' && ontriggercompute}
      <Button variant="secondary" size="xs" onclick={ontriggercompute} disabled={isComputing}>
        <RefreshCw class="cinder-icon-sm" />
        Compute Diff
      </Button>
    {/if}

    {#if hasChanges}
      {#if changeCount > 0}
        <div class="navigation">
          <Button
            variant="ghost"
            size="xs"
            onclick={onjumpprevious}
            aria-label="Previous change ([)"
          >
            <ChevronLeft class="cinder-icon-sm" />
          </Button>
          <Kbd label="[" size="sm" aria-hidden="true" class="nav-kbd" />
          <span class="change-counter">
            {currentChangeIndex >= 0 ? currentChangeIndex + 1 : '-'} / {changeCount}
          </span>
          <Kbd label="]" size="sm" aria-hidden="true" class="nav-kbd" />
          <Button variant="ghost" size="xs" onclick={onjumpnext} aria-label="Next change (])">
            <ChevronRight class="cinder-icon-sm" />
          </Button>
        </div>
      {:else}
        <!-- Only front matter changes, no body navigation available -->
        <span class="front-matter-only-hint">Front matter only</span>
      {/if}
    {:else}
      <Badge variant="success">No changes</Badge>
    {/if}
  </div>
</div>

<style>
  .diff-toolbar {
    /*
     * The keycap visibility rule below reacts to how much room THIS toolbar
     * has, not to how wide the viewport is — a narrow DiffViewer in a wide
     * window needs the same treatment as a narrow window. RESPONSIVE-POLICY.md
     * requires @container for that, and platform:audit enforces it.
     */
    container-type: inline-size;
    container-name: cinder-diff-toolbar;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1-5) var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border-muted);
    background: var(--cinder-surface);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-3);
  }

  .stats {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  :global(.stat-badge) {
    font-family: var(--cinder-font-mono);
    height: 1.25rem;
    min-width: 1.5rem;
    justify-content: center;
  }

  .no-changes {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-3);
  }

  .navigation {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  .change-counter {
    font-size: var(--cinder-text-xs);
    font-family: var(--cinder-font-mono);
    color: var(--cinder-text-muted);
    min-width: 3rem;
    text-align: center;
  }

  .front-matter-only-hint {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  /*
   * The "[" / "]" keycaps annotate the Previous/Next buttons (each button's
   * own aria-label already carries the accessible description, e.g.
   * "Previous change ([)"), so the keycaps themselves are aria-hidden and
   * purely visual. They drop out when the toolbar itself is cramped, without
   * touching the buttons, which stay visible at every width. `:global()` is
   * required because `Kbd`'s `class` prop lands on cinder's own scoped
   * `<kbd>` element, not this file's style scope (same pattern as
   * `.stat-badge` above).
   */
  /* Scoped through `.diff-toolbar` rather than left as a bare `:global(.nav-kbd)`.
     Svelte scopes the `.diff-toolbar` half to this component and leaves the inner
     selector global, so the rule reaches Kbd's own scoped element without also
     claiming every `.nav-kbd` that happens to exist elsewhere on the page. */
  .diff-toolbar :global(.nav-kbd) {
    display: inline-flex;
  }

  /* Visible is the BASELINE; the query only simplifies a cramped toolbar. Written this
     way round deliberately: hiding by default and revealing inside a `min-width` query
     leaves the keycaps permanently hidden anywhere container queries do not resolve,
     turning a progressive enhancement into a silent loss. This matches the direction
     `markdown-editor.svelte`'s separator rule already uses. */
  @container cinder-diff-toolbar (width < 30rem) {
    .diff-toolbar :global(.nav-kbd) {
      display: none;
    }
  }
</style>
