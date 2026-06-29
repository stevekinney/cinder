import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Column definition accepted by BentoGrid. */
export type BentoGridColumns = number | string;

/** Props for the BentoGrid component. */
export type BentoGridProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /**
   * Positive integer number of equal-width columns or a full CSS
   * `grid-template-columns` value.
   */
  columns?: BentoGridColumns;
  /** Uniform row and column gap. */
  gap?: string;
  /** Row gap override. Wins over `gap` for rows. */
  rowGap?: string;
  /** Column gap override. Wins over `gap` for columns. */
  columnGap?: string;
  /**
   * Enables a narrow-screen fallback where BentoGrid becomes a single column
   * and BentoCell placement resets to auto flow.
   * @default true
   */
  collapse?: boolean;
  /** Rendered HTML tag. */
  as?: string;
  /** Custom class merged with `.cinder-bento-grid`. */
  class?: string;
  /** Bento grid contents. */
  children: Snippet;
};
