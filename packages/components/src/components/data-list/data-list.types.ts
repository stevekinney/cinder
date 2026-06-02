import type { Snippet } from 'svelte';

import type { StackedListItemDensity } from '../stacked-list-item/stacked-list-item.types.ts';

export type DataListProps<T> = {
  /** The records to render. Each is passed to `children`. */
  items: T[];
  /**
   * Key extractor for efficient DOM updates. Svelte uses this to identify each
   * row when the list is reordered, filtered, or updated — without it, rows are
   * matched by index and the wrong row instances may receive updated props.
   *
   * Strongly recommended for any list that can change after initial render:
   *
   * ```svelte
   * <DataList {items} key={(m) => m.id}>
   * ```
   *
   * Omit only for truly static, never-reordered lists (e.g. a fixed reference
   * list). When omitted, Svelte falls back to index-based reconciliation.
   */
  key?: (item: T) => string | number;
  /**
   * List-level density inherited by StackedListItem rows that do not set their
   * own `density` prop. Omit to let each row use its own default. A per-row
   * `density` always overrides this list-level value.
   *
   * Note: when passing a variable that may be `undefined`, spread conditionally
   * because `exactOptionalPropertyTypes` is enabled:
   * `{...(density ? { density } : {})}`
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
