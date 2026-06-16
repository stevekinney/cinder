import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the GridItem component. */
export type GridItemProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Number of columns this item spans. */
  span?: number | string;
  /** Explicit `grid-column-start` value. */
  columnStart?: number | string;
  /** Explicit `grid-column-end` value. */
  columnEnd?: number | string;
  /** Number of rows this item spans. */
  rowSpan?: number | string;
  /** Explicit `grid-row-start` value. */
  rowStart?: number | string;
  /** Rendered HTML tag. */
  as?: string;
  /** Custom class merged with `.cinder-grid-item`. */
  class?: string;
  /** Grid item contents. */
  children: Snippet;
};
