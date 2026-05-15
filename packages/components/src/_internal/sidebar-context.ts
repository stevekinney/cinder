/**
 * Internal sidebar context. Published by `<Sidebar>` so descendant components
 * (e.g. `side-navigation-group`, `navigation-item`) can adapt to the sidebar's
 * collapsed state without prop drilling.
 *
 * The context value intentionally exposes only `collapsed` for v1. Additional
 * coordination signals require a separate API review.
 */

import { getContext } from 'svelte';

/**
 * Context published by `<Sidebar>` for descendant components. `collapsed` is a
 * getter so reads stay reactive — destructuring breaks reactivity, property
 * reads preserve it.
 */
export type SidebarContextValue = {
  /** True when the sidebar is in icon-only / hidden mode. */
  readonly collapsed: boolean;
};

/** Symbol key for the sidebar Svelte context. Not exported from package root. */
export const SIDEBAR_CONTEXT_KEY = Symbol('cinder.sidebar');

/**
 * Read the nearest enclosing `<Sidebar>` context. Returns `undefined` when no
 * `<Sidebar>` ancestor exists. Readers must handle the `undefined` case.
 *
 * The try-catch mirrors the SSR/test-environment edge case documented in
 * `form-field-context.ts` and `surface-context.ts`.
 */
export function getSidebarContext(): SidebarContextValue | undefined {
  try {
    return getContext<SidebarContextValue | undefined>(SIDEBAR_CONTEXT_KEY);
  } catch {
    return undefined;
  }
}
