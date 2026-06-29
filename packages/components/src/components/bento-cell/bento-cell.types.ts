import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the BentoCell component. */
export type BentoCellProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Number of columns this cell spans. */
  colSpan?: number | string;
  /** Number of rows this cell spans. */
  rowSpan?: number | string;
  /** Explicit `grid-column-start` value. */
  columnStart?: number | string;
  /** Explicit `grid-column-end` value. */
  columnEnd?: number | string;
  /** Explicit `grid-row-start` value. */
  rowStart?: number | string;
  /** Explicit `grid-row-end` value. */
  rowEnd?: number | string;
  /** Rendered HTML tag. */
  as?: string;
  /** Custom class merged with `.cinder-bento-cell`. */
  class?: string;
  /** Bento cell contents. */
  children: Snippet;
};
