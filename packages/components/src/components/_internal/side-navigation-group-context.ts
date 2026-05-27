/**
 * Shared context contract between SideNavigationGroup and SideNavigationItem.
 *
 * Kept under `_internal/` so the context handles are reachable by both
 * components without being part of the package's public surface, matching the
 * convention established by `_internal/command-list-context.ts`.
 *
 * Unlike the command-palette context, this one is *optional*: a
 * `SideNavigationItem` may live directly in a flat `SideNavigation` with no
 * group ancestor. `tryGetSideNavigationGroupContext` returns `undefined` in
 * that case rather than throwing — a missing context is a no-op.
 *
 * The mechanism lets a group light up its disclosure trigger ("the current
 * page lives in here") when any descendant item is active, even while the
 * group is collapsed. Registration is fixed at mount; live reparenting of the
 * same item instance across group boundaries is unsupported (Svelte unmounts
 * and remounts on keyed `{#each}`/`{#if}` moves, which runs cleanup plus a
 * fresh `register()` — correct by construction).
 */

import { createContext } from 'svelte';

/** Registration handle returned to each child item. */
export type SideNavigationGroupRegistration = {
  /** Report whether this item is currently active. Idempotent per state. */
  setActive: (active: boolean) => void;
  /** Remove this item from the active tally on unmount. Idempotent. */
  unregister: () => void;
};

export type SideNavigationGroupContext = {
  /** Register a descendant item; returns its handle. */
  register: () => SideNavigationGroupRegistration;
};

const [getSideNavigationGroupContextStrict, setSideNavigationGroupContext] =
  createContext<SideNavigationGroupContext>();

export { setSideNavigationGroupContext };

/**
 * Optional read — items outside a group are valid (flat sidebars), so a
 * missing context resolves to `undefined` instead of throwing.
 */
export function tryGetSideNavigationGroupContext(): SideNavigationGroupContext | undefined {
  try {
    return getSideNavigationGroupContextStrict();
  } catch {
    return undefined;
  }
}
