import type { Component } from 'svelte';

/**
 * The frozen route registry (plan §2, §13 T1.6). Maps a path pattern to a
 * lazy dynamic import of that domain's route component. This is a SHARED
 * file — do not edit it to wire up a surface's internals; each domain's
 * `src/routes/<domain>/index.svelte` is where that track's implementation
 * lives, and this file only ever needs a new entry when a whole new
 * top-level domain is added (not expected after Phase 0).
 *
 * `:id`-style segments are simple named params; the router
 * (`src/lib/router.svelte.ts`, Foundation track) owns matching semantics.
 */
export interface RouteDefinition {
  /** Path pattern, e.g. `/workflows/:id`. */
  pattern: string;
  /** Lazily imports the route's default-exported Svelte component. */
  load: () => Promise<{ default: Component }>;
}

export const routes: readonly RouteDefinition[] = [
  { pattern: '/', load: () => import('../routes/dashboard/index.svelte') },
  { pattern: '/workflows', load: () => import('../routes/workflows/index.svelte') },
  { pattern: '/workflows/:id', load: () => import('../routes/workflows/index.svelte') },
  { pattern: '/schedules', load: () => import('../routes/schedules/index.svelte') },
  { pattern: '/workers', load: () => import('../routes/workers/index.svelte') },
  { pattern: '/reviews', load: () => import('../routes/reviews/index.svelte') },
  { pattern: '/storage', load: () => import('../routes/storage/index.svelte') },
  { pattern: '/system', load: () => import('../routes/system/index.svelte') },
];
