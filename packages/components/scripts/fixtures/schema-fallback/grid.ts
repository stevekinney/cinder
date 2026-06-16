import type { Snippet } from 'svelte';

export type GridColumns = number | string;

export type GridProps = {
  /**
   * Positive integer number of equal-width columns or a full CSS `grid-template-columns` value.
   * Numeric values render as `repeat(<columns>, 1fr)`.
   */
  columns?: GridColumns;
  /** Grid contents. */
  children: Snippet;
};
