import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { NonVoidHTMLElementTagName } from '../../utilities/html-element-types.ts';

/** Props for the BentoCell component. */
export type BentoCellProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Number of columns this cell spans. */
  columnSpan?: number | string;
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
  as?: NonVoidHTMLElementTagName;
  /** Custom class merged with `.cinder-bento-cell`. */
  class?: string;
  /** Bento cell contents. */
  children: Snippet;
};
