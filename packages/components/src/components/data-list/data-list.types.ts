import type { Snippet } from 'svelte';

import type { StackedListItemDensity } from '../stacked-list-item/stacked-list-item.types.ts';

export type DataListProps<T> = {
  /** The records to render. Each is passed to `children`. */
  items: T[];
  /**
   * List-level density inherited by StackedListItem rows that do not set their
   * own `density` prop. Omit to let each row use its own default. A per-row
   * `density` always overrides this list-level value.
   */
  density?: StackedListItemDensity;
  class?: string;
  /**
   * Row renderer. MUST render an `<li>` (the list root is a `<ul role="list">`).
   * StackedListItem is the recommended row — it renders an `<li>` with
   * leading/title/description/meta/trailing slots.
   */
  children: Snippet<[T]>;
  /** Rendered (wrapped in an `<li>`) when `items` is empty. */
  empty?: Snippet;
};
