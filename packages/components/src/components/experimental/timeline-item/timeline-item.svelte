<script lang="ts" module>
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
