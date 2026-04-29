<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * EXPERIMENTAL — TimelineItem API may change between minor versions.
   *
   * One entry in a Timeline. Renders a marker (dot or icon) on the rail
   * with the item content beside it.
   */
  export type TimelineItemProps = {
    /** Optional ISO timestamp / formatted time string for the entry header. */
    time?: string;
    /** Visible event title. */
    title?: string;
    /** Optional status that drives the marker color via a data attribute. */
    status?: 'info' | 'success' | 'warning' | 'danger';
    /** Additional class names merged with `.cinder-timeline-item`. */
    class?: string;
    /** Item body content. */
    children?: Snippet;
    /** Custom marker glyph. Default is a colored dot. */
    marker?: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';

  let {
    time,
    title,
    status = 'info',
    class: className,
    children,
    marker,
  }: TimelineItemProps = $props();
</script>

<li class={cn('cinder-timeline-item', className)} data-cinder-status={status}>
  <span class="cinder-timeline-item__marker" aria-hidden="true">
    {#if marker}
      {@render marker()}
    {/if}
  </span>
  <div class="cinder-timeline-item__content">
    {#if time || title}
      <header class="cinder-timeline-item__header">
        {#if title}
          <span class="cinder-timeline-item__title">{title}</span>
        {/if}
        {#if time}
          <time class="cinder-timeline-item__time" datetime={time}>{time}</time>
        {/if}
      </header>
    {/if}
    {#if children}
      <div class="cinder-timeline-item__body">{@render children()}</div>
    {/if}
  </div>
</li>
