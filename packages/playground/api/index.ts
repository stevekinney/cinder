/**
 * Vercel Function entrypoint for the cinder playground.
 *
 * The playground is a plain `Bun.serve` HTTP server (see
 * `../src/playground-server.ts`) whose request handling is fully expressed by
 * the exported `handleRequest` function: `(Request) => Promise<Response>`.
 * Vercel Functions accept exactly that shape via the Web Standard `{ fetch }`
 * export, so this file is a thin adapter — no Node `req`/`res` shim, no
 * framework, no second copy of the routing table.
 *
 * Why a function under `api/` (and not the root entrypoint):
 *   Vercel's Bun backend mode auto-detects a *root* entrypoint by filename
 *   (`server`/`index`/`app`/`main` in the project root or `src/`) and switches
 *   into a single-root-function mode that has NO documented way to bundle extra
 *   files. The on-the-fly Svelte builds need `packages/components/src` at
 *   request time, which only `functions[...].includeFiles` can package — and
 *   `functions` keys MUST live under `api/` (a `src/server.ts` key fails with
 *   "doesn't match any Serverless Functions inside the api directory"). So the
 *   server module is named `playground-server.ts` (NOT a root-entrypoint magic
 *   name) to stay out of backend auto-detection, and this `api/index.ts`
 *   function — with `includeFiles` and the `vercel.json` rewrites that funnel
 *   every route here — is the real, unambiguous entrypoint.
 *
 * Cold-start / warm-cache note:
 *   `handleRequest` lazily builds (and module-caches) bundles on first request
 *   and serves hashed chunk URLs from those same caches. Vercel keeps a Lambda
 *   instance's module state alive between invocations, so the first request to
 *   a given route on a fresh instance pays the build cost and subsequent
 *   requests to that instance (including the hashed-chunk URLs the entry
 *   references) are served warm. No eager pre-build runs here; it would blow the
 *   function cold-start budget for routes the visitor never hits.
 *
 * Filesystem note:
 *   `handleRequest` resolves `packages/components/src` relative to the source
 *   location of `playground-server.ts`. The `functions[].includeFiles` glob in
 *   `vercel.json` bundles that tree (plus the Svelte build plugin under
 *   `packages/components/scripts`) into the deployed function so the on-the-fly
 *   builds can read it.
 */

import { handleRequest } from '../src/playground-server.ts';

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
