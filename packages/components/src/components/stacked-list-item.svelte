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
  import { classNames } from '../utilities/class-names.ts';

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

  // Filter out any on* attributes that TypeScript already blocks but which could
  // leak through at runtime (e.g. from dynamic spreads or JS consumers).
  const safeRest = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !key.startsWith('on')),
  ) as Omit<typeof rest, `on${string}`>;

  // When target="_blank" and no rel is supplied, default to "noreferrer" to
  // prevent reverse-tabnapping.
  const resolvedRel = target === '_blank' && !rel ? 'noreferrer' : rel;
</script>

<li
  class={classNames(
    'cinder-stacked-list-item',
    leading && 'cinder-stacked-list-item--has-leading',
    trailing && 'cinder-stacked-list-item--has-trailing',
    className,
  )}
  data-cinder-density={density}
  {...safeRest}
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
          <a
            class="cinder-stacked-list-item__title-link"
            {href}
            {target}
            rel={resolvedRel}
            {hreflang}
          >
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
