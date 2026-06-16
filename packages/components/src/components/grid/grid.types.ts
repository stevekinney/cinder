import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Column definition accepted by Grid. */
export type GridColumns = number | string;

/** Props for the Grid component. */
export type GridProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /**
   * Positive integer number of equal-width columns or a full CSS `grid-template-columns` value.
   * Numeric values render as `repeat(<columns>, 1fr)`.
   */
  columns?: GridColumns;
  /** Uniform row and column gap. */
  gap?: string;
  /** Row gap override. Wins over `gap` for rows. */
  rowGap?: string;
  /** Column gap override. Wins over `gap` for columns. */
  columnGap?: string;
  /**
   * Minimum item width for an intrinsic auto-fill grid. When present, this takes
   * precedence over `columns`.
   */
  minItemWidth?: string;
  /** Rendered HTML tag. */
  as?: string;
  /** Custom class merged with `.cinder-grid`. */
  class?: string;
  /** Grid contents. */
  children: Snippet;
};
