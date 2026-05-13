<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { LineDiffStats } from '@cinder/markdown/diff/line-diff';
  import type { DiffState, DiffTier } from './diff-controller.svelte';

  export type ViewMode = 'unified' | 'final' | 'original';

  export type DiffToolbarProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Current view mode (bindable) */
    viewMode?: ViewMode;
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
    /** Additional toolbar actions rendered in the right section */
    actions?: Snippet;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge.svelte';
  import Button from '../button.svelte';
  import Kbd from '../kbd.svelte';
  import SegmentedControl from '../segmented-control.svelte';
  import Spinner from '../spinner.svelte';
  import { ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from '../icons/index.ts';

  let {
    viewMode = $bindable<ViewMode>('unified'),
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
    actions,
    class: className,
    ...rest
  }: DiffToolbarProps = $props();

  // Default diffState values if not provided
  const tier = $derived<DiffTier>(diffState?.tier ?? 'realtime');
  const isStale = $derived(diffState?.isStale ?? false);
  const isComputing = $derived(diffState?.isComputing ?? false);

  // View mode options for the segmented control
  const viewModeOptions: { value: ViewMode; label: string }[] = [
    { value: 'unified', label: 'Unified' },
    { value: 'final', label: 'Final' },
    { value: 'original', label: 'Original' },
  ];
</script>

<div class={classNames('diff-toolbar', className)} {...rest}>
  <div class="toolbar-left">
    <SegmentedControl
      id="diff-view-mode"
      selectionMode="single"
      size="sm"
      label="View mode"
      hideLabel
      bind:value={viewMode}
      options={viewModeOptions}
    />
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

    <!-- Revert All button -->
    {#if hasChanges && !readonly && onrevertall}
      <Button variant="secondary" size="xs" onclick={onrevertall}>
        <RotateCcw class="icon-sm" />
        Revert All
      </Button>
    {/if}

    <!-- Size-based gating controls (DEP-47) -->
    {#if tier === 'manual' && ontriggercompute}
      <Button variant="secondary" size="xs" onclick={ontriggercompute} disabled={isComputing}>
        <RefreshCw class="icon-sm" />
        Compute Diff
      </Button>
    {/if}

    {#if hasChanges}
      {#if changeCount > 0}
        <div class="navigation">
          <Button variant="ghost" size="xs" onclick={onjumpprevious} aria-label="Previous change">
            <ChevronLeft class="icon-sm" />
          </Button>
          <span class="change-counter">
            {currentChangeIndex >= 0 ? currentChangeIndex + 1 : '-'} / {changeCount}
          </span>
          <Button variant="ghost" size="xs" onclick={onjumpnext} aria-label="Next change">
            <ChevronRight class="icon-sm" />
          </Button>
        </div>
        <div class="shortcuts">
          <Kbd label="[" />
          <Kbd label="]" />
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1-5) var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border);
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

  .shortcuts {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  .front-matter-only-hint {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  @media (max-width: 480px) {
    .shortcuts {
      display: none;
    }
  }
</style>
