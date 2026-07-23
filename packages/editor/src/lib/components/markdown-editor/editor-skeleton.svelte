<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  export type EditorSkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Number of text lines to simulate */
    lines?: number;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  let { lines = 8, class: className, ...rest }: EditorSkeletonProps = $props();

  // Deterministic shimmer widths cycled by line index.
  // The table provides visual variety without Math.random() so snapshot runs
  // are stable across renders. First and last lines get fixed heading/tail widths;
  // interior lines cycle through the table.
  const SHIMMER_WIDTHS = [68, 84, 56, 92, 72, 80, 60, 88] as const;

  const lineWidths = $derived.by(() =>
    Array.from({ length: lines }, (_, i) => {
      if (i === 0) return 45; // First line shorter (heading)
      if (i === lines - 1) return 30; // Last line shorter
      return SHIMMER_WIDTHS[i % SHIMMER_WIDTHS.length] ?? 68;
    }),
  );
</script>

<div
  class={classNames('editor-skeleton', 'surface', className)}
  role="status"
  aria-label="Loading editor"
  {...rest}
>
  <span class="sr-only">Loading editor...</span>

  <div class="skeleton-content">
    {#each lineWidths as width, i (i)}
      <div class="skeleton-line" style:--skeleton-line-width="{width}%"></div>
    {/each}
  </div>
</div>

<style>
  .editor-skeleton {
    display: flex;
    flex-direction: column;
    min-height: 200px;
    overflow: hidden;
  }

  .skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-4);
  }

  /*
   * Skeleton line styles - customizable via CSS variables:
   *   --skeleton-line-width: Width of each line (default: 100%)
   */
  .skeleton-line {
    width: var(--skeleton-line-width, 100%);
    height: 1rem;
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-sm);
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line:nth-child(odd) {
    animation-delay: 0.15s;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-line {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
