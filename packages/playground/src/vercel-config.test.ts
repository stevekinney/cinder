/**
 * Tests for the Vercel deployment configuration.
 *
 * The playground deploys to Vercel's Bun runtime as a single root-entrypoint
 * Function. Vercel's Bun backend mode auto-detects `src/server.ts` (it matches
 * the `server` filename in `src/`) and runs its default export, which handles
 * every route through `handleRequest` — so no `rewrites` table is needed (the
 * root entrypoint is a catch-all, like Hono/Elysia/Koa on Vercel). These tests
 * guard the two ways that setup silently rots:
 *
 *   (a) `src/server.ts` stops default-exporting the `{ fetch }` shape Vercel
 *       calls, or stops delegating to the real handler — which 500s every route
 *       with "Invalid export found in module" (the failure this config fixes).
 *   (b) The `functions` entry stops pointing at `src/server.ts` or stops
 *       bundling the components source the on-the-fly builds read at runtime.
 *
 * These are pure config/contract assertions — no DOM, no rendering, no live
 * Vercel calls.
 */

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const PLAYGROUND_ROOT = join(import.meta.dirname, '..');

/**
 * Read and JSON-parse `vercel.json`. A parse failure here is itself a useful
 * signal — a malformed config would break every deploy.
 */
async function readVercelConfig(): Promise<Record<string, unknown>> {
  const text = await Bun.file(join(PLAYGROUND_ROOT, 'vercel.json')).text();
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('vercel.json did not parse to an object');
  }
  return parsed as Record<string, unknown>;
}

describe('vercel.json', () => {
  it('is valid JSON with the keys a Bun function deploy needs', async () => {
    const config = await readVercelConfig();
    expect(config['$schema']).toBe('https://openapi.vercel.sh/vercel.json');
    // Bun runtime, not Node — the server relies on Bun.file / Bun.build.
    expect(config['bunVersion']).toBe('1.x');
    // No meta-framework: the playground is a hand-rolled Bun.serve server.
    expect(config['framework']).toBeNull();
    expect(typeof config['buildCommand']).toBe('string');
    expect(typeof config['outputDirectory']).toBe('string');
  });

  it('registers exactly one function — the src/server.ts root entrypoint — with the components source bundled in', async () => {
    const config = await readVercelConfig();
    const functions = config['functions'];
    expect(typeof functions).toBe('object');
    expect(functions).not.toBeNull();
    const fns = functions as Record<string, unknown>;
    // Vercel's Bun runtime auto-detects src/server.ts as the root entrypoint;
    // the functions entry must name that exact file so includeFiles attaches.
    expect(Object.keys(fns)).toEqual(['src/server.ts']);
    const entry = fns['src/server.ts'] as Record<string, unknown>;
    // The on-the-fly builds read packages/components/{src,scripts} at request
    // time, so those trees must be bundled into the deployed function.
    expect(entry['includeFiles']).toBe('../components/{src,scripts}/**');
    // maxDuration is load-bearing: a cold-start on-the-fly Svelte build can
    // exceed Vercel's 10s default and time out without it.
    expect(entry['maxDuration']).toBe(60);
  });

  it('relies on the catch-all root entrypoint, not a rewrites table', async () => {
    const config = await readVercelConfig();
    // The Bun root entrypoint receives every route, so an explicit rewrites
    // table is unnecessary. Asserting its absence keeps the config from
    // re-acquiring the per-route drift the rewrites model used to risk.
    expect(config['rewrites']).toBeUndefined();
  });
});

describe('src/server.ts (Vercel Bun-runtime entrypoint)', () => {
  it('default-exports a Web Standard { fetch } handler', async () => {
    const entry = await import('./server.ts');
    expect(typeof entry.default).toBe('object');
    expect(typeof entry.default.fetch).toBe('function');
  });

  it('delegates /ping to the real handler (proves the wiring, not a stub)', async () => {
    const entry = await import('./server.ts');
    const response = await entry.default.fetch(new Request('http://localhost/ping'));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });
});
