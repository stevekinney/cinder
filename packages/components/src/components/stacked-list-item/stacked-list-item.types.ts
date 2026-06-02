import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
export type StackedListItemDensity = 'comfortable' | 'condensed';
type LiEventAttribute = Extract<keyof HTMLAttributes<HTMLLIElement>, `on${string}`>;
type ForwardedLiAttributes = Omit<
  HTMLAttributes<HTMLLIElement>,
  'title' | 'class' | 'role' | 'tabindex' | LiEventAttribute
>;
type StackedListItemBase = ForwardedLiAttributes & {
  /**
   * Density token surfaced as `data-cinder-density`. When omitted, inherits the
   * enclosing DataList's list-level `density` (if any), then falls back to
   * `comfortable`. An explicit value here always overrides the list default.
   */
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
