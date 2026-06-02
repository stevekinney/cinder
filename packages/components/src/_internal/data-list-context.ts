/**
 * Internal DataList context, factored out of `data-list.svelte` so that
 * `stacked-list-item.svelte` (the recommended DataList row) can read the
 * list-level density without importing the `.svelte` module path.
 *
 * DataList publishes a list-level `density` so a consumer can set the density
 * once on the list rather than on every row. `StackedListItem` reads this
 * context and falls back to its own `density` prop, which in turn defaults to
 * `comfortable` — so a standalone `StackedListItem` (no DataList ancestor) is
 * unaffected, and a per-row `density` prop always overrides the list default.
 *
 * The context value is intentionally minimal (density only). Additional
 * list-level fields require a separate API review before being added.
 */

import { createContext } from 'svelte';

import type { StackedListItemDensity } from '../components/stacked-list-item/stacked-list-item.types.ts';
import { optionalContext } from './optional-context.ts';

/**
 * Context published by `<DataList>` for descendant rows. `density` is a getter
 * property so reads stay reactive — reading `context.density` inside a
 * `$derived` flows through the getter. Destructuring breaks reactivity.
 */
export type DataListContextValue = {
  /** The list-level density, or `undefined` when the list set none. */
  readonly density: StackedListItemDensity | undefined;
};

const [getDataListContextStrict, setDataListContextRaw] = createContext<DataListContextValue>();

/** Publish the DataList context for descendant rows. */
export function setDataListContext(context: DataListContextValue): void {
  setDataListContextRaw(context);
}

/**
 * Read the nearest enclosing `<DataList>` context. Returns `undefined` when no
 * `<DataList>` ancestor exists (a standalone `StackedListItem` in a
 * consumer-owned list is a supported, first-class state).
 */
export const getDataListContext: () => DataListContextValue | undefined =
  optionalContext(getDataListContextStrict);
