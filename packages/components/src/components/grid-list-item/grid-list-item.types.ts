import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
type LiEventAttribute = Extract<keyof HTMLAttributes<HTMLLIElement>, `on${string}`>;
type GridListItemBase = Omit<
  HTMLAttributes<HTMLLIElement>,
  'title' | 'class' | 'role' | 'tabindex' | LiEventAttribute
> & {
  /** Additional class merged onto the `.cinder-grid-list__item` root element. */
  class?: string;
  /** Optional image region (avatar, thumbnail). */
  image?: Snippet;
  /** Primary label. Provides the accessible name for the stretched link when `href` is set. */
  title?: Snippet;
  /** Secondary description. */
  subtitle?: Snippet;
  /** Tertiary metadata (badges, supplementary text). */
  meta?: Snippet;
  /**
   * Action buttons. This wrapper is lifted above the stretched-link overlay
   * via `position: relative; z-index: 1` so buttons remain clickable.
   */
  actions?: Snippet;
};
/** Non-linkified item — no stretched-link overlay. */
type GridListItemStatic = GridListItemBase & {
  href?: never;
  target?: never;
  rel?: never;
};
/**
 * Linkified item — `title` becomes a stretched link covering the entire card
 * via a pseudo-element overlay. Only `actions` (and descendants marked with
 * `data-cinder-stretched-link-escape`) remain pointer-operable above the overlay.
 *
 * `title` is required when `href` is set: it provides the accessible name for
 * the stretched-link anchor. An item with `href` but no `title` would render a
 * pseudo-element overlay with no reachable `<a>` and no accessible name.
 */
type GridListItemLinked = GridListItemBase & {
  /** Destination URL. When set, the `title` snippet is rendered as a stretched `<a>` anchor covering the entire tile. */
  href: string;
  /** Required when href is set — provides the accessible name for the anchor. */
  title: Snippet;
  /**
   * When `target` matches `"_blank"` (case-insensitive), the component
   * automatically composes `rel="noopener noreferrer"` with any
   * consumer-supplied `rel` tokens to prevent reverse-tabnapping.
   */
  target?: HTMLAnchorAttributes['target'];
  /** `rel` attribute forwarded to the stretched-link anchor; `noopener noreferrer` is merged automatically when `target="_blank"`. */
  rel?: HTMLAnchorAttributes['rel'];
};
export type GridListItemProps = GridListItemStatic | GridListItemLinked;
