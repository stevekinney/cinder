/**
 * Type-level contract for `@lostgradient/cinder/tokens/registry`.
 *
 * This file is never executed and exports nothing meaningful — it exists so
 * `typecheck` fails if the generated module stops supporting a lookup style a
 * consumer depends on. It is the only place that checks the emitted module's
 * TYPES: `tokens-consumer/check.mjs` exercises the same lookups at runtime, but
 * it is JavaScript, so it cannot catch a type regression.
 *
 * The regression it guards against is real and was caught in review rather than
 * by any gate: emitting the registry as `… as const satisfies TokenRegistry`
 * validates the literal without widening it, so every lookup map carried only
 * its generated keys and no string index signature. Indexing with a `string`
 * then failed with TS7053 — which is exactly the documented use, iterating a
 * resolved context and mapping each path to its custom property.
 */

import { TOKEN_REGISTRY, type TokenRegistryEntry } from './registry.generated.ts';

declare const dynamicKey: string;

// Dynamic lookups: the primary use. Each must compile with a `string` key.
export const cssPropertyForPath: string | undefined = TOKEN_REGISTRY.pathToCssProperty[dynamicKey];
export const pathForCssProperty: string | undefined = TOKEN_REGISTRY.cssPropertyToPath[dynamicKey];
export const pathsForCssProperty: readonly string[] | undefined =
  TOKEN_REGISTRY.cssPropertyToPaths[dynamicKey];
export const tokensInCategory: readonly string[] | undefined =
  TOKEN_REGISTRY.byCategory[dynamicKey];
export const tokensInComponent: readonly string[] | undefined =
  TOKEN_REGISTRY.byComponent[dynamicKey];

// Entries stay iterable and structurally match the exported entry type.
export const entries: readonly TokenRegistryEntry[] = TOKEN_REGISTRY.entries;
export const firstCssProperty: string | undefined = TOKEN_REGISTRY.entries[0]?.cssProperty;

// The optional-key facets are readable without a non-null assertion, which is
// what makes them optional keys rather than required-with-undefined.
export const firstCategory: string | undefined = TOKEN_REGISTRY.entries[0]?.category;
export const firstComponent: string | undefined = TOKEN_REGISTRY.entries[0]?.component;
export const firstDescription: string | undefined = TOKEN_REGISTRY.entries[0]?.description;
