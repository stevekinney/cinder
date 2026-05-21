/**
 * Public re-exports for cinder's `Highlighter` contract. Consumers who
 * implement a custom highlighter (instead of using the bundled
 * `cinder/highlighters/shiki` adapter from PR 3) import the type from here
 * and pass the function to `<CinderProvider highlighter={...}>`.
 *
 * The implementation symbol + helper live under `_internal/` to keep the
 * cross-component context bridge a single source of truth; this file is the
 * documented public surface.
 */

export type { Highlighter } from '../_internal/highlighter-context.ts';
