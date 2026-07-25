import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Number of columns in the stat grid, or 'auto' for responsive auto-fit. */
export type StatisticGroupColumns = 1 | 2 | 3 | 4 | 'auto';
/** Visual variant for the stat group container. */
export type StatisticGroupVariant = 'default' | 'cards' | 'shared-borders';
export type StatisticGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /**
   * Optional accessible label for the whole stat set. When provided, the
   * container becomes `role="group"` and uses this value as its accessible name.
   */
  label?: string;
  /**
   * Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.
   * @default 'auto'
   */
  columns?: StatisticGroupColumns;
  /**
   * Visual variant; surfaced as `data-cinder-variant` for CSS styling.
   * - `'default'` — plain grid, no borders or backgrounds.
   * - `'cards'` — each stat gets a card-style border and shadow.
   * - `'shared-borders'` — single outer border with 1px gap dividers between stats.
   * @default 'default'
   */
  variant?: StatisticGroupVariant;
  /** Statistic children, typically one or more `<Statistic>` components. */
  children: Snippet;
  /** Additional class names merged with `.cinder-statistic-group`. */
  class?: string;
};

/** Schema generator surface for StatisticGroup — excludes native attributes except supported styling hooks. */
export interface StatisticGroupSchemaProps {
  /**
   * Optional accessible label for the whole stat set. When provided, the
   * container becomes `role="group"` and uses this value as its accessible name.
   */
  label?: string;
  /**
   * Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.
   * @default 'auto'
   */
  columns?: StatisticGroupColumns;
  /**
   * Visual variant; surfaced as `data-cinder-variant` for CSS styling.
   * - `'default'` — plain grid, no borders or backgrounds.
   * - `'cards'` — each stat gets a card-style border and shadow.
   * - `'shared-borders'` — single outer border with 1px gap dividers between stats.
   * @default 'default'
   */
  variant?: StatisticGroupVariant;
  /** Statistic children, typically one or more `<Statistic>` components. */
  children: Snippet;
  /** Additional class names merged with `.cinder-statistic-group`. */
  class?: string;
  /** Inline style string applied to the `.cinder-statistic-group` root. */
  style?: string;
}
