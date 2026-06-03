/**
 * Shared context contract between Tabs (producer) and Tab, TabList, and
 * TabPanel (consumers).
 *
 * Kept inside `tabs/` so the handles are co-located with the type definition
 * in `tabs.types.ts` and reachable by the leaf components without being part
 * of the package's public surface.
 *
 * The context is *required* — a Tab, TabList, or TabPanel outside a Tabs
 * provider is a programmer error. The `getTabsContext` getter therefore throws
 * (via Svelte 5's `createContext`) when no ancestor has called `setTabsContext`.
 */

import { createContext } from 'svelte';

import type { TabsContext } from './tabs.types.ts';

export type { TabsContext };

const [getTabsContextStrict, setTabsContext] = createContext<TabsContext>();

export { setTabsContext };

/**
 * Read the nearest enclosing `<Tabs>` context. Throws when no `<Tabs>`
 * ancestor exists — using Tab, TabList, or TabPanel outside a provider is a
 * programmer error.
 */
export const getTabsContext = getTabsContextStrict;
