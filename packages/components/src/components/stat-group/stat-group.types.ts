import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Number of columns in the stat grid, or 'auto' for responsive auto-fit. */
export type StatGroupColumns = 1 | 2 | 3 | 4 | 'auto';
/** Visual variant for the stat group container. */
export type StatGroupVariant = 'default' | 'cards' | 'shared-borders';
export type StatGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /**
   * Optional accessible label for the whole stat set. When provided, the
   * container becomes `role="group"` and uses this value as its accessible name.
   */
  label?: string;
  /**
   * Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.
   * @default 'auto'
   */
  columns?: StatGroupColumns;
  /**
   * Visual variant; surfaced as `data-cinder-variant` for CSS styling.
   * - `'default'` — plain grid, no borders or backgrounds.
   * - `'cards'` — each stat gets a card-style border and shadow.
   * - `'shared-borders'` — single outer border with 1px gap dividers between stats.
   * @default 'default'
   */
  variant?: StatGroupVariant;
  /** Stat children, typically one or more `<Stat>` components. */
  children: Snippet;
  /** Additional class names merged with `.cinder-stat-group`. */
  class?: string;
};
