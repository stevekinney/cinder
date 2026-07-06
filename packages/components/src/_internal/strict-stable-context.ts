import { getContext, setContext } from 'svelte';

/**
 * Create a required context pair keyed by a stable package-level symbol.
 *
 * Use this only when a public parent/leaf family can be loaded through separate
 * package entries in the same app. Svelte's `createContext` intentionally owns
 * an unexported per-module key; a stable key keeps split package entries on the
 * same context channel while preserving the strict getter contract.
 */
export function strictStableContext<T>(
  key: string,
  missingMessage: string,
): [getContextStrict: () => T, setContextStrict: (context: T) => T] {
  const contextKey = Symbol.for(key);

  return [
    () => {
      const context = getContext<T | undefined>(contextKey);
      if (context === undefined) {
        throw new Error(`missing_context: ${missingMessage}`);
      }
      return context;
    },
    (context: T) => setContext(contextKey, context),
  ];
}
