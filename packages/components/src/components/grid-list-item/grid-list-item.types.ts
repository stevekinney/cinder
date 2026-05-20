import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
type GridListItemBase = Omit<HTMLAttributes<HTMLLIElement>, 'title'> & {
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
 * If `title` is absent, no anchor is rendered even when `href` is set.
 */
type GridListItemLinked = GridListItemBase & {
  href: string;
  /**
   * When `target` matches `"_blank"` (case-insensitive), the component
   * automatically composes `rel="noopener noreferrer"` with any
   * consumer-supplied `rel` tokens to prevent reverse-tabnapping.
   */
  target?: HTMLAnchorAttributes['target'];
  rel?: HTMLAnchorAttributes['rel'];
};
export type GridListItemProps = GridListItemStatic | GridListItemLinked;
