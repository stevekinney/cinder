import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { NonVoidHTMLElementTagName } from '../../utilities/html-element-types.ts';

/** Column definition accepted by Grid. */
export type GridColumns = number | string;

/** Props for the Grid component. */
export type GridProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /**
   * Positive integer number of equal-width columns or a full CSS `grid-template-columns` value.
   * Numeric values render as `repeat(<columns>, 1fr)`.
   */
  columns?: GridColumns | undefined;
  /** Uniform row and column gap. */
  gap?: string | undefined;
  /** Row gap override. Wins over `gap` for rows. */
  rowGap?: string | undefined;
  /** Column gap override. Wins over `gap` for columns. */
  columnGap?: string | undefined;
  /** Enables a narrow-screen fallback where the grid becomes a single column. */
  collapse?: boolean | undefined;
  /**
   * Minimum item width for an intrinsic auto-fill grid. When present, this takes
   * precedence over `columns`.
   */
  minItemWidth?: string;
  /** Rendered HTML tag. */
  as?: NonVoidHTMLElementTagName;
  /** Custom class merged with `.cinder-grid`. */
  class?: string;
  /** Grid contents. */
  children: Snippet;
};
