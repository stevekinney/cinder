<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Separator entry inside a feed marking a stream discontinuity such as a reconnect or a sequence gap.
   * @tag timeline
   * @tag event
   * @useWhen Marking a reconnect, replay, or gap between entries in a feed's log arm.
   * @avoidWhen Standing alone outside a feed — it expects the feed list semantics around it. | feed
   * @avoidWhen Separating generic page content — use divider instead. | divider
   * @related feed, feed-event, divider
   */
  export type { FeedBoundaryProps } from './feed-boundary.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { FeedBoundaryProps } from './feed-boundary.types.ts';

  let { label, datetime, timestamp, class: className, ...rest }: FeedBoundaryProps = $props();
</script>

<li {...rest} class={classNames('cinder-feed-boundary', className)}>
  <div class="cinder-feed-boundary__content" role="separator" aria-label={label}>
    {#if datetime}
      <time class="cinder-feed-boundary__time" {datetime} title={datetime}>
        {timestamp ?? datetime}
      </time>
    {:else if timestamp}
      <span class="cinder-feed-boundary__time">{timestamp}</span>
    {/if}
    <span>{label}</span>
  </div>
</li>
