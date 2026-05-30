/**
 * Vercel Function entrypoint for the cinder playground.
 *
 * The playground is a plain `Bun.serve` HTTP server (see `../src/server.ts`)
 * whose request handling is fully expressed by the exported `handleRequest`
 * function: `(Request) => Promise<Response>`. Vercel Functions accept exactly
 * that shape via the Web Standard `fetch` export, so this file is a thin
 * adapter — no Node `req`/`res` shim, no framework, no second copy of the
 * routing table.
 *
 * Why a single function instead of a static export:
 *   The playground builds Svelte bundles on the fly with `Bun.build`, reading
 *   component sources from `packages/components/src` at request time. There is
 *   no pre-rendered static artifact to ship; every `/page-bundle/*`,
 *   `/bundle/*`, and `/shell-bundle/*` response is compiled on demand. A single
 *   Bun Function that delegates to `handleRequest` preserves that behavior
 *   exactly. All routes are funnelled here by the `rewrites` in `vercel.json`.
 *
 * Cold-start / warm-cache note:
 *   `handleRequest` lazily builds (and module-caches) bundles on first request
 *   and serves hashed chunk URLs from those same caches. Vercel keeps a Lambda
 *   instance's module state alive between invocations, so the first request to
 *   a given route on a fresh instance pays the build cost and subsequent
 *   requests to that instance (including the hashed-chunk URLs the entry
 *   references) are served warm. This mirrors the dev server's behavior without
 *   the file watcher (which only exists in `startServer`, not in
 *   `handleRequest`). No eager pre-build runs here; it would blow the function
 *   cold-start budget for routes the visitor never hits.
 *
 * Filesystem note:
 *   `handleRequest` resolves `packages/components/src` relative to the source
 *   location of `server.ts`. The `functions[].includeFiles` glob in
 *   `vercel.json` bundles that tree (plus the Svelte build plugin under
 *   `packages/components/scripts`) into the deployed function so the on-the-fly
 *   builds can read it.
 */

import { handleRequest } from '../src/server.ts';

export default {
  /**
   * Handle every incoming HTTP request by delegating to the playground's
   * shared request handler. Vercel routes all paths to this function via the
   * `rewrites` rules in `vercel.json`.
   */
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
