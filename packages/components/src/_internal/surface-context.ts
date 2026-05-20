/**
 * Internal surface context shape, factored out of `surface.svelte` so that
 * plain `.ts` consumers can import the context handles and types without
 * going through the `.svelte` module path.
 *
 * `surface.svelte` re-exports `SurfaceTone` so the public type still surfaces
 * through the existing `Surface` re-export in the package barrel.
 *
 * The context value intentionally contains only `tone` for v1. Additional
 * fields (density, emphasis level, theme override) require a separate API
 * review before being added.
 */

import { createContext } from 'svelte';

/** The visual affordance of a surface — describes what the surface looks like. */
export type SurfaceTone = 'default' | 'raised' | 'inset' | 'transparent';

/**
 * Context published by `<Surface>` for descendant components. All members are
 * getter properties on the object so reads stay reactive — when a consumer
 * reads `context.tone` inside a `$derived`, the read flows through the getter.
 * Destructuring breaks reactivity; property reads preserve it.
 *
 * The v1 context value intentionally contains only `tone`.
 */
export type SurfaceContextValue = {
  /** The tone of the nearest enclosing `<Surface>`. */
  readonly tone: SurfaceTone;
};

const [getSurfaceContextStrict, setSurfaceContextRaw] = createContext<SurfaceContextValue>();

/** Publish the surface context for descendants. */
export function setSurfaceContext(context: SurfaceContextValue): void {
  setSurfaceContextRaw(context);
}

/**
 * Read the nearest enclosing `<Surface>` context. Returns `undefined` when no
 * `<Surface>` ancestor exists. All readers MUST handle the `undefined` case;
 * cinder makes no implicit "default" assumption when there is no parent.
 *
 * Svelte 5's `createContext` getter throws when no provider exists; we wrap
 * it here so the consumer contract — `undefined` on no provider — is preserved.
 */
export function getSurfaceContext(): SurfaceContextValue | undefined {
  try {
    return getSurfaceContextStrict();
  } catch {
    return undefined;
  }
}
