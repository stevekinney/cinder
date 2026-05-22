<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { LineDiffStats } from 'cinder/markdown/diff/line-diff';

  export type DiffSummaryBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Diff statistics from getDiffStats() */
    stats: LineDiffStats;
    /** Whether the diff viewer is expanded */
    expanded?: boolean;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  /**
   * Compact summary bar showing diff statistics with expand/collapse toggle.
   *
   * Displays:
   * - Total change count (insertions + deletions + replacements)
   * - Word delta: "+N" for added, "-N" for removed
   * - Expand/collapse button to show/hide the full DiffViewer
   *
   * @example
   * ```svelte
   * <DiffSummaryBar {stats} bind:expanded />
   * ```
   */

  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import { ChevronDown, ChevronUp, FileText } from '../icons/index.ts';

  let {
    stats,
    expanded = $bindable(false),
    class: className,
    ...rest
  }: DiffSummaryBarProps = $props();

  // Total change count (lines added + removed + modified)
  const changeCount = $derived(stats.added + stats.removed + stats.modified);

  // Singular/plural handling
  const changeLabel = $derived(changeCount === 1 ? 'line' : 'lines');
</script>

<div class={classNames('diff-summary-bar', className)} {...rest}>
  <div class="summary-content">
    <FileText class="icon-sm text-muted" aria-hidden="true" />
    <Badge variant="neutral">{changeCount} {changeLabel}</Badge>
    <span class="stats-text">
      {#if stats.added > 0}
        <span class="stat-added">+{stats.added}</span>
      {/if}
      {#if stats.removed > 0}
        <span class="stat-removed">-{stats.removed}</span>
      {/if}
      {#if stats.modified > 0}
        <span class="stat-modified">~{stats.modified}</span>
      {/if}
    </span>
  </div>
  <Button variant="ghost" size="sm" onclick={() => (expanded = !expanded)}>
    {expanded ? 'Hide' : 'Review'}
    {#if expanded}
      <ChevronUp class="icon-sm" />
    {:else}
      <ChevronDown class="icon-sm" />
    {/if}
  </Button>
</div>

<style>
  .diff-summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-4);
    padding: var(--cinder-space-2) var(--cinder-space-4);
    background: var(--cinder-surface-raised);
    border-top: 1px solid var(--cinder-border);
    border-radius: 0 0 var(--cinder-radius-md) var(--cinder-radius-md);
  }

  .summary-content {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  .stats-text {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  .stat-added {
    color: var(--cinder-success);
    font-weight: var(--cinder-font-medium);
  }

  .stat-removed {
    color: var(--cinder-danger);
    font-weight: var(--cinder-font-medium);
  }

  .stat-modified {
    color: var(--cinder-warning);
    font-weight: var(--cinder-font-medium);
  }

  /* Responsive: stack on very narrow screens */
  @media (max-width: 360px) {
    .diff-summary-bar {
      flex-wrap: wrap;
      gap: var(--cinder-space-2);
    }
  }
</style>
