<script lang="ts" module>
  export type { FeedProps } from './feed.types.ts';
</script>

<script lang="ts">
  import type { FeedProps } from './feed.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let { live = false, class: className, children, ...rest }: FeedProps = $props();

  const liveRegionAttributes = $derived(
    live ? { 'aria-live': 'polite' as const, 'aria-atomic': 'false' as const } : {},
  );
</script>

<ol {...rest} {...liveRegionAttributes} class={cn('cinder-feed', className)}>
  {@render children()}
</ol>
