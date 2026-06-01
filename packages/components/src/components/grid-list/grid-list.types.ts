import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type GridListProps = Omit<HTMLAttributes<HTMLUListElement>, 'role'> & {
  /**
   * Minimum width of each grid cell, expressed as a CSS `<length>` value
   * (e.g. `"16rem"`, `"240px"`, `"min(20rem, 100%)"`). Used as the first
   * argument to `minmax()` inside a `repeat(auto-fill, ...)` track.
   * Default: `"16rem"`. Empty string is treated as unset.
   */
  minColumnWidth?: string;
  /** Extra class names merged with `cinder-grid-list`. */
  class?: string;
  /** Items — typically `GridListItem` instances. */
  children: Snippet;
};
