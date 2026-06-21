import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Layout-safe HTML element names for use as the Masonry container tag.
 * Void elements (`img`, `input`, `br`, `hr`, etc.) cannot contain children
 * and are excluded; inline elements that do not accept block children are also
 * excluded.
 */
export type MasonryElement =
  | 'article'
  | 'aside'
  | 'div'
  | 'footer'
  | 'header'
  | 'main'
  | 'nav'
  | 'section'
  | 'ul'
  | 'ol';

/** Props for the Masonry component. */
export type MasonryProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** CSS column count value. */
  columns?: string;
  /** Gap between columns and between direct children. */
  gap?: string;
  /**
   * Rendered HTML tag. Constrained to layout-safe container elements;
   * void elements such as `img`, `input`, `br`, and `hr` are excluded.
   * Defaults to `'div'`.
   */
  as?: MasonryElement;
  /** Custom class merged with `.cinder-masonry`. */
  class?: string;
  /** Masonry contents. */
  children: Snippet;
};
