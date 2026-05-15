<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { LineDiff, WordChange } from '@cinder/markdown/diff/line-diff';
  import type { BadgeVariant } from '../badge.svelte';

  export type ViewMode = 'unified' | 'final' | 'original';

  export type DiffFrontMatterProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Unique id for the front matter section */
    id?: string;
    /** Line diffs for front matter content */
    diffs: LineDiff[];
    /** Current view mode */
    viewMode: ViewMode;
    /** Whether the section is expanded (bindable) */
    expanded?: boolean;
    /** Badge label to show (e.g., "Changed") */
    badgeLabel?: string | null;
    /** Badge variant */
    badgeVariant?: BadgeVariant;
    /** Optional: custom word change renderer (passed to DiffLine) */
    wordChangeRenderer?: Snippet<[{ changes: WordChange[] }]> | undefined;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import FrontMatterHeader from './front-matter-header.svelte';
  import DiffLine from './diff-line.svelte';

  let {
    id = 'front-matter',
    diffs,
    viewMode,
    expanded = $bindable(true),
    badgeLabel = null,
    badgeVariant = 'warning',
    wordChangeRenderer,
    class: className,
    ...rest
  }: DiffFrontMatterProps = $props();

  /**
   * Whether there are any changes in the front matter.
   * Derived from the diffs - if any line is not 'same', there are changes.
   */
  const hasChanges = $derived(diffs.some((d) => d.type !== 'same'));

  const toggleId = $derived(`${id}-toggle`);
  const contentId = $derived(`${id}-content`);
</script>

<div class={classNames('front-matter-section', className)} data-has-changes={hasChanges} {...rest}>
  <FrontMatterHeader
    id={toggleId}
    controlsId={contentId}
    bind:expanded
    variant="inline"
    {badgeLabel}
    {badgeVariant}
  />

  {#if expanded}
    <div id={contentId} class="front-matter-content">
      {#each diffs as lineDiff, idx (`fm-${idx}`)}
        <DiffLine diff={lineDiff} {viewMode} {wordChangeRenderer} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .front-matter-section {
    border-bottom: 1px solid var(--cinder-border);
    margin-bottom: var(--cinder-space-2);
  }

  .front-matter-section[data-has-changes='true'] {
    border-inline-start: 3px solid var(--cinder-warning);
  }

  .front-matter-content {
    border-top: 1px solid var(--cinder-border);
    background: color-mix(in oklch, var(--cinder-surface-inset), transparent 50%);
  }
</style>
