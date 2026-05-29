/**
 * Shared helper for contexts that treat a missing provider as a valid state.
 *
 * Svelte 5's `createContext` returns a strict `[get, set]` pair whose `get`
 * THROWS when no ancestor has called `set`. That contract is exactly right for
 * required contexts (a `CommandItem` outside a command list is a programmer
 * error), but several cinder components legitimately support running with no
 * parent provider — a standalone `<Input>` with no `<FormField>` ancestor, a
 * `<SideNavigationItem>` in a flat sidebar with no group, and so on. Those
 * readers want `undefined` on no provider, not a throw.
 *
 * Before this helper, each such reader hand-rolled the same
 * `try { return getStrict() } catch { return undefined }` block. This factors
 * the throw→undefined conversion into ONE place so the contract is named,
 * documented, and not re-derived at every call site.
 */

/**
 * Wrap a strict context getter (from `createContext`) so it returns `undefined`
 * when no provider exists instead of throwing. Use this for contexts where a
 * missing parent provider is a supported, first-class state.
 *
 * @param getStrict The strict getter returned by `createContext` (throws when
 *   no ancestor called `set`).
 * @returns A getter that yields the context value, or `undefined` when no
 *   provider is mounted.
 */
export function optionalContext<T>(getStrict: () => T): () => T | undefined {
  return () => {
    try {
      return getStrict();
    } catch {
      return undefined;
    }
  };
}
