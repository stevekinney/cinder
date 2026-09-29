<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { LineDiff } from '@lostgradient/markdown';
  import type { BadgeVariant } from '@lostgradient/cinder';
  import type { Snippet } from 'svelte';

  import type {
    DiffViewerFrontMatterAnnotationContext,
    DiffViewerMode,
  } from './diff-viewer.types.ts';

  export type DiffFrontMatterProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Unique id for the front matter section */
    id?: string;
    /** Line diffs for front matter content */
    diffs: LineDiff[];
    /** Current view mode */
    viewMode: DiffViewerMode;
    /** Whether the section is expanded (bindable) */
    expanded?: boolean;
    /** Badge label to show (e.g., "Changed") */
    badgeLabel?: string | null;
    /** Badge variant */
    badgeVariant?: BadgeVariant;
    /**
     * Rendered whenever front matter is present, regardless of expanded state
     * or whether it changed -- front matter is always "ambiguous" for
     * line-level anchoring, so it always offers a file-level comment hook,
     * with changed field names as context (COR-514 / DR-4).
     */
    fileAnnotation?: Snippet<[DiffViewerFrontMatterAnnotationContext]> | undefined;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import FrontMatterHeader from './front-matter-header.svelte';
  import DiffLine from './diff-line.svelte';
  import { extractFrontMatterChangedFields } from './diff-viewer.annotation.ts';

  let {
    id = 'front-matter',
    diffs,
    viewMode,
    expanded = $bindable(true),
    badgeLabel = null,
    badgeVariant = 'warning',
    fileAnnotation,
    class: className,
    ...rest
  }: DiffFrontMatterProps = $props();

  /**
   * Whether there are any changes in the front matter.
   * Derived from the diffs - if any line is not 'same', there are changes.
   */
  const hasChanges = $derived(diffs.some((d) => d.type !== 'same'));
  const changedFields = $derived(extractFrontMatterChangedFields(diffs));

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

  {#if fileAnnotation}
    {@render fileAnnotation({ changedFields })}
  {/if}

  {#if expanded}
    <div id={contentId} class="front-matter-content">
      {#each diffs as lineDiff, idx (`fm-${idx}:${lineDiff.type}:${lineDiff.type === 'modified' ? lineDiff.newText : lineDiff.text}`)}
        <DiffLine diff={lineDiff} {viewMode} />
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
    border-inline-start: 3px solid var(--cinder-status-warning-solid);
  }

  .front-matter-content {
    border-top: 1px solid var(--cinder-border);
    background: color-mix(in oklch, var(--cinder-surface-inset), transparent 50%);
  }
</style>
