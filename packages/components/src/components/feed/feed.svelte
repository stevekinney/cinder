<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Ordered list container for a chronological stream of feed-event entries, optionally exposed as a live region.
   * @tag timeline
   * @tag activity
   * @useWhen Rendering an activity log, audit trail, or notification timeline.
   * @useWhen Announcing newly appended entries to assistive technology via the live prop.
   * @avoidWhen Displaying a one-off transient notice — use toast-region or banner instead.
   * @related feed-event
   */
  export type { FeedProps } from './feed.types.ts';
</script>

<script lang="ts">
  import type { FeedProps } from './feed.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { live = false, class: className, children, ...rest }: FeedProps = $props();

  const liveRegionAttributes = $derived(
    live ? { 'aria-live': 'polite' as const, 'aria-atomic': 'false' as const } : {},
  );
</script>

<ol {...rest} {...liveRegionAttributes} class={classNames('cinder-feed', className)}>
  {@render children()}
</ol>
