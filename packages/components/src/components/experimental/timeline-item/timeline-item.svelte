<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Single entry inside a timeline rail with a status-colored marker, optional title and timestamp header, and a body slot.
   * @tag timeline
   * @tag event
   * @useWhen Rendering one event along a timeline rail with consistent marker, header, and body structure.
   * @useWhen Coloring marker semantics by status (info, success, warning, danger) to communicate severity at a glance.
   * @avoidWhen The entry lives in a social activity stream rather than a workflow rail — feed-event fits better.
   * @avoidWhen Production-critical surfaces — this component is alpha and may change or be removed before promotion to beta.
   * @related timeline, feed-event
   */
  export type { TimelineItemProps } from './timeline-item.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../../utilities/class-names.ts';
  import type { TimelineItemProps } from './timeline-item.types.ts';

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
