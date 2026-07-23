<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Compact added, removed, and modified line-count summary that accompanies a Markdown diff view.
   * @tag diff
   * @tag statistics
   * @tag domain-suite
   * @useWhen Surfacing a quick numeric summary of changes alongside or in lieu of a full diff surface.
   * @useWhen Annotating a list of files or pull requests with line-change counts as part of the source-diff-viewer suite.
   * @avoidWhen Rendering the actual hunked diff content — pair with `DiffViewer` from `@lostgradient/editor` for the full document comparison.
   * @avoidWhen Generic numeric badges that have nothing to do with diffs — reach for stat or badge instead.
   * @related source-diff-viewer
   */
  export type {
    DiffStatisticsDensity,
    DiffStatisticsProps,
    DiffStatisticsVariant,
  } from './diff-statistics.types.ts';
</script>

<script lang="ts">
  import type { DiffStatisticsProps } from './diff-statistics.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    added,
    removed,
    modified,
    variant = 'default',
    density,
    hideZero = false,
    class: customClassName,
    ...rest
  }: DiffStatisticsProps = $props();

  const total = $derived(added + removed + modified);
  const pluralize = (count: number, singular: string, plural: string) =>
    count === 1 ? singular : plural;

  const addedLabel = $derived(`${added} ${pluralize(added, 'line', 'lines')} added`);
  const removedLabel = $derived(`${removed} ${pluralize(removed, 'line', 'lines')} removed`);
  const modifiedLabel = $derived(`${modified} ${pluralize(modified, 'line', 'lines')} modified`);

  const showAdded = $derived(!hideZero || added > 0);
  const showRemoved = $derived(!hideZero || removed > 0);
  const showModified = $derived(!hideZero || modified > 0);
  const hasAnyStatistics = $derived(showAdded || showRemoved || showModified);
</script>

<!--
  Static summary, not a live region. `role="group"` + `aria-label` labels the
  cluster ("N lines changed") while keeping the visible added/removed/modified
  breakdown readable by assistive technology — unlike `role="img"`, which would
  hide that inner text, and unlike `role="status"`, which would re-announce on
  every render. Diff stats describe a fixed diff, not a value that updates in place.
-->
<div
  class={classNames('cinder-diff-statistics', customClassName)}
  data-cinder-variant={variant}
  data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
  role="group"
  aria-label={`${total} ${pluralize(total, 'line', 'lines')} changed`}
  {...rest}
>
  {#if hasAnyStatistics}
    {#if showAdded}
      <span
        class="cinder-diff-statistics__stat cinder-diff-statistics__stat--added"
        aria-label={addedLabel}
      >
        <span class="cinder-diff-statistics__prefix" aria-hidden="true">+</span>
        <span class="cinder-diff-statistics__value">{added}</span>
        {#if variant === 'default'}
          <span class="cinder-diff-statistics__label">added</span>
        {/if}
      </span>
    {/if}

    {#if showRemoved}
      <span
        class="cinder-diff-statistics__stat cinder-diff-statistics__stat--removed"
        aria-label={removedLabel}
      >
        <span class="cinder-diff-statistics__prefix" aria-hidden="true">-</span>
        <span class="cinder-diff-statistics__value">{removed}</span>
        {#if variant === 'default'}
          <span class="cinder-diff-statistics__label">removed</span>
        {/if}
      </span>
    {/if}

    {#if showModified}
      <span
        class="cinder-diff-statistics__stat cinder-diff-statistics__stat--modified"
        aria-label={modifiedLabel}
      >
        <span class="cinder-diff-statistics__prefix" aria-hidden="true">~</span>
        <span class="cinder-diff-statistics__value">{modified}</span>
        {#if variant === 'default'}
          <span class="cinder-diff-statistics__label">modified</span>
        {/if}
      </span>
    {/if}
  {:else}
    <span class="cinder-diff-statistics__stat cinder-diff-statistics__stat--none">
      No changes
    </span>
  {/if}
</div>
