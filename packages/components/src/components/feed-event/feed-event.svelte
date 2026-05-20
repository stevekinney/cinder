<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Individual entry within a feed that pairs a timestamp with a content snippet and optional leading icon.
   * @tag timeline
   * @tag event
   * @useWhen Rendering a single activity or audit entry inside a feed parent.
   * @useWhen Switching between an icon-led and a connector-led visual treatment via the variant prop.
   * @avoidWhen Standing alone outside a feed — it expects the feed list semantics around it.
   * @related feed
   */
  export type { FeedEventProps, FeedEventVariant } from './feed-event.types.ts';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '../../utilities/class-names.ts';
  import type { FeedEventProps } from './feed-event.types.ts';

  let {
    datetime,
    variant = 'icon',
    class: className,
    icon,
    content,
    timestamp,
    ...rest
  }: FeedEventProps = $props();
</script>

<li {...rest} class={cn('cinder-feed-event', className)} data-cinder-variant={variant}>
  <span class="cinder-feed-event-rail" aria-hidden="true">
    {#if variant === 'icon'}
      <span class="cinder-feed-event-icon">{@render (icon as Snippet)()}</span>
    {:else}
      <span class="cinder-feed-event-dot"></span>
    {/if}
  </span>
  <div class="cinder-feed-event-body">
    <div class="cinder-feed-event-content">{@render content()}</div>
    <time class="cinder-feed-event-time" {datetime}>{@render timestamp()}</time>
  </div>
</li>
