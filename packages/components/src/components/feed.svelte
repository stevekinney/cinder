<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type FeedProps = Omit<HTMLAttributes<HTMLOListElement>, 'children' | 'class'> & {
    class?: string;
    /**
     * When true, the wrapper becomes an ARIA live region: `aria-live="polite"`
     * and `aria-atomic="false"`. Use for feeds that mutate while the user is
     * on the page (streaming notifications, log tails, chat-like activity).
     * Defaults to false — a polite live region on a static feed is noise.
     */
    live?: boolean;
    /** Feed events (typically `<FeedEvent>` children). */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { live = false, class: className, children, ...rest }: FeedProps = $props();

  const liveRegionAttributes = $derived(
    live ? { 'aria-live': 'polite' as const, 'aria-atomic': 'false' as const } : {},
  );
</script>

<ol {...rest} {...liveRegionAttributes} class={cn('cinder-feed', className)}>
  {@render children()}
</ol>
