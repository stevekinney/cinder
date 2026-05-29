/**
 * Internal sidebar context. Published by `<Sidebar>` so descendant components
 * (e.g. `side-navigation-group`, `navigation-item`) can adapt to the sidebar's
 * collapsed state without prop drilling.
 *
 * The context value intentionally exposes only `collapsed` for v1. Additional
 * coordination signals require a separate API review.
 */

import { createContext } from 'svelte';

import { optionalContext } from './optional-context.ts';

/**
 * Context published by `<Sidebar>` for descendant components. `collapsed` is a
 * getter so reads stay reactive — destructuring breaks reactivity, property
 * reads preserve it.
 */
export type SidebarContextValue = {
  /** True when the sidebar is in icon-only / hidden mode. */
  readonly collapsed: boolean;
};

const [getSidebarContextStrict, setSidebarContextRaw] = createContext<SidebarContextValue>();

/** Publish the sidebar context for descendants. */
export function setSidebarContext(context: SidebarContextValue): void {
  setSidebarContextRaw(context);
}

/**
 * Read the nearest enclosing `<Sidebar>` context. Returns `undefined` when no
 * `<Sidebar>` ancestor exists. Readers must handle the `undefined` case.
 *
 * Svelte 5's `createContext` getter throws when no provider exists;
 * `optionalContext` converts that throw to `undefined` so the consumer
 * contract — `undefined` on no provider — is preserved.
 */
export const getSidebarContext: () => SidebarContextValue | undefined =
  optionalContext(getSidebarContextStrict);
