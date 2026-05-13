<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes, HTMLAnchorAttributes } from 'svelte/elements';

  export type StackedListItemDensity = 'comfortable' | 'condensed';

  type LiEventAttribute = Extract<keyof HTMLAttributes<HTMLLIElement>, `on${string}`>;

  type ForwardedLiAttributes = Omit<
    HTMLAttributes<HTMLLIElement>,
    'title' | 'class' | 'role' | 'tabindex' | LiEventAttribute
  >;

  type StackedListItemBase = ForwardedLiAttributes & {
    /** Density token surfaced as `data-cinder-density`. Default `comfortable`. */
    density?: StackedListItemDensity;
    /** Leading visual (avatar, icon, status dot). */
    leading?: Snippet;
    /** Primary label. Required. */
    title: Snippet;
    /** Secondary description below the title. */
    description?: Snippet;
    /** Tertiary metadata (timestamp, badge, system label). */
    meta?: Snippet;
    /** Trailing region (chevron, action button, dropdown trigger). */
    trailing?: Snippet;
    /** Merged with `cinder-stacked-list-item`. */
    class?: string;
  };

  /** Non-linkified row — `title` snippet renders as plain text. */
  type StackedListItemStatic = StackedListItemBase & {
    href?: never;
    target?: never;
    rel?: never;
    hreflang?: never;
  };

  /** Linkified row — `title` snippet renders as `<a href>`. */
  type StackedListItemLinked = StackedListItemBase & {
    href: string;
    target?: HTMLAnchorAttributes['target'];
    rel?: HTMLAnchorAttributes['rel'];
    hreflang?: HTMLAnchorAttributes['hreflang'];
  };

  export type StackedListItemProps = StackedListItemStatic | StackedListItemLinked;
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    density = 'comfortable',
    class: className,
    leading,
    title,
    description,
    meta,
    trailing,
    href,
    target,
    rel,
    hreflang,
    ...rest
  }: StackedListItemProps = $props();
</script>

<li
  class={cn('cinder-stacked-list-item', className)}
  class:cinder-stacked-list-item--has-leading={!!leading}
  class:cinder-stacked-list-item--has-trailing={!!trailing}
  data-cinder-density={density}
  {...rest}
>
  <div class="cinder-stacked-list-item__layout">
    {#if leading}
      <div class="cinder-stacked-list-item__leading">
        {@render leading()}
      </div>
    {/if}
    <div class="cinder-stacked-list-item__body">
      <div class="cinder-stacked-list-item__title">
        {#if href !== undefined}
          <a class="cinder-stacked-list-item__title-link" {href} {target} {rel} {hreflang}>
            {@render title()}
          </a>
        {:else}
          {@render title()}
        {/if}
      </div>
      {#if description}
        <div class="cinder-stacked-list-item__description">{@render description()}</div>
      {/if}
      {#if meta}
        <div class="cinder-stacked-list-item__meta">{@render meta()}</div>
      {/if}
    </div>
    {#if trailing}
      <div class="cinder-stacked-list-item__trailing">
        {@render trailing()}
      </div>
    {/if}
  </div>
</li>
