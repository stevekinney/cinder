<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type FeedEventVariant = 'icon' | 'minimal';

  type FeedEventBase = Omit<HTMLAttributes<HTMLLIElement>, 'children' | 'class'> & {
    class?: string;
    /**
     * ISO 8601 datetime string. Rendered as `<time datetime={datetime}>` so
     * assistive tech and parsers receive a machine-readable timestamp. The
     * visible label inside the `<time>` element is consumer-controlled via
     * the required `timestamp` snippet.
     */
    datetime: string;
    /** Main event content (description, links, secondary metadata). */
    content: Snippet;
    /**
     * Renders inside the `<time>` element. Consumer chooses formatting —
     * relative (`2m ago`), absolute (`May 12, 2:30 PM`), or anything else.
     * Required so the component stays presentational and SSR-deterministic.
     */
    timestamp: Snippet;
  };

  type FeedEventIcon = FeedEventBase & {
    /** Icon variant: renders a circular badge on the rail with the icon inside. */
    variant?: 'icon';
    /** Required for the icon variant. Type-enforced by the discriminated union. */
    icon: Snippet;
  };

  type FeedEventMinimal = FeedEventBase & {
    /** Minimal variant: renders a small dot on the rail, no icon. */
    variant: 'minimal';
    icon?: never;
  };

  export type FeedEventProps = FeedEventIcon | FeedEventMinimal;
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

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
