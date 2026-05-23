<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Single event inside a timeline rail with a decorative tone marker, timestamp-first header, optional group header, and body content.
   * @tag timeline
   * @tag event
   * @useWhen Rendering one event along a timeline rail with consistent marker, header, connector, and body structure.
   * @useWhen Coloring decorative markers by tone (info, success, warning, error) while keeping the meaningful status in title or content.
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
    datetime,
    timestamp,
    title,
    tone = 'info',
    connectorAfter = 'visible',
    groupHeader,
    groupHeaderLevel = 3,
    class: className,
    children,
    marker,
    ...rest
  }: TimelineItemProps = $props();
</script>

<li
  {...rest}
  class={cn('cinder-timeline-item', className)}
  data-cinder-tone={tone}
  data-cinder-connector-after={connectorAfter}
>
  {#if groupHeader}
    <div class="cinder-timeline__group-header" role="heading" aria-level={groupHeaderLevel}>
      {groupHeader}
    </div>
  {/if}
  <div class="cinder-timeline-item__event">
    <span class="cinder-timeline-item__marker" aria-hidden="true" inert>
      {#if marker}
        {@render marker()}
      {/if}
    </span>
    <div class="cinder-timeline-item__content">
      <header class="cinder-timeline-item__header">
        <time class="cinder-timeline-item__time" {datetime}>{timestamp}</time>
        <span class="cinder-timeline-item__title">{title}</span>
      </header>
      {#if children}
        <div class="cinder-timeline-item__body">{@render children()}</div>
      {/if}
    </div>
  </div>
</li>
