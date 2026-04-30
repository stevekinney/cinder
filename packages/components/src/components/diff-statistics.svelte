<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  /** Visual density for the statistics display. */
  export type DiffStatisticsVariant = 'default' | 'compact';

  export type DiffStatisticsProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Number of added lines. */
    added: number;
    /** Number of removed lines. */
    removed: number;
    /** Number of modified lines. */
    modified: number;
    /** Visual density. */
    variant?: DiffStatisticsVariant;
    /** Hide statistics with a zero value. */
    hideZero?: boolean;
    /** Additional class names merged with `.cinder-diff-statistics`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    added,
    removed,
    modified,
    variant = 'default',
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

<div
  class={classNames('cinder-diff-statistics', customClassName)}
  data-cinder-variant={variant}
  role="status"
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
