import type { ComponentManifest } from './types.ts';

/**
 * Manifest cache state shared between `playground-server.ts` (the reader —
 * `getManifests`/`getComponentManifest`/`getStandaloneManifests`, which stay
 * in that file as part of its composition-root responsibilities) and
 * `file-watcher.ts` (the invalidator — `invalidateCachesForChange`).
 *
 * Living in its own module, rather than inside either reader or invalidator,
 * avoids a circular import: `playground-server.ts` already imports
 * `startWatcher`/`scheduleRebuild` from `file-watcher.ts`, so
 * `invalidateCachesForChange` cannot also import a reset function back out of
 * `playground-server.ts`.
 */

/** Resolved manifest array — cached after first analysis. */
export let manifestCache: ComponentManifest[] | null = null;
/** In-flight analyzeAll() promise — prevents duplicate concurrent analyses. */
export let manifestPromise: Promise<ComponentManifest[]> | null = null;
export const componentManifestCache = new Map<string, ComponentManifest>();

/** Publish a freshly analyzed manifest array. Only the caller that isn't racing a newer invalidation should call this. */
export function setManifestCache(manifests: ComponentManifest[] | null): void {
  manifestCache = manifests;
}

/** Publish (or clear) the in-flight analysis promise. */
export function setManifestPromise(promise: Promise<ComponentManifest[]> | null): void {
  manifestPromise = promise;
}

/** Clear every manifest cache. Called by `invalidateCachesForChange` on every invalidation tier. */
export function clearManifestCaches(): void {
  manifestCache = null;
  manifestPromise = null;
  componentManifestCache.clear();
}
