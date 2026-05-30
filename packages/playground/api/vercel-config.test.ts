/**
 * Tests for the Vercel deployment configuration.
 *
 * The playground deploys to Vercel as a single Bun Function (`api/index.ts`)
 * with every route funnelled to it by `rewrites` in `vercel.json`. These tests
 * guard the two ways that setup silently rots:
 *
 *   (a) The function entry stops exporting the `{ fetch }` shape Vercel calls,
 *       or stops delegating to the real handler.
 *   (b) Someone adds a new route to `src/server.ts` (or removes one) and the
 *       `vercel.json` rewrites drift out of sync, so the new route 404s in
 *       production while working locally. Each route family the server answers
 *       must have a rewrite that reaches the function.
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

/**
 * Narrow the parsed config's `rewrites` to an array of `{ source }` rules.
 * Throws if the shape is wrong so a malformed rewrite table fails loudly.
 */
function rewriteSources(config: Record<string, unknown>): string[] {
  const { rewrites } = config;
  if (!Array.isArray(rewrites)) throw new Error('vercel.json rewrites must be an array');
  return rewrites.map((rule) => {
    if (typeof rule !== 'object' || rule === null || !('source' in rule)) {
      throw new Error('each rewrite must be an object with a source');
    }
    const { source } = rule as { source: unknown };
    if (typeof source !== 'string') throw new Error('rewrite source must be a string');
    return source;
  });
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

  it('registers exactly one function, the api/index.ts entry, with the components source bundled in', async () => {
    const config = await readVercelConfig();
    const functions = config['functions'];
    expect(typeof functions).toBe('object');
    expect(functions).not.toBeNull();
    const fns = functions as Record<string, unknown>;
    expect(Object.keys(fns)).toEqual(['api/index.ts']);
    const entry = fns['api/index.ts'] as Record<string, unknown>;
    // The on-the-fly builds read packages/components/{src,scripts} at request
    // time, so those trees must be bundled into the deployed function.
    expect(entry['includeFiles']).toBe('../components/{src,scripts}/**');
  });

  it('rewrites every playground route family to the single function', async () => {
    const config = await readVercelConfig();
    const sources = rewriteSources(config);
    const allToFunction = (config['rewrites'] as { destination: string }[]).every(
      (rule) => rule.destination === '/api/index',
    );
    expect(allToFunction).toBe(true);

    // One representative path per route family the server's handleRequest
    // answers. If a new family is added to server.ts, add it here AND to
    // vercel.json — this list is the contract between the two.
    const representativePaths = [
      '/',
      '/ping',
      '/events',
      '/styles.css',
      '/styles/tokens.css',
      '/components/button/button.css',
      '/c/button',
      '/page/button',
      '/page-bundle/button.js',
      '/shell-bundle/shell.js',
      '/bundle/button/basic.js',
      '/api/manifest',
      '/api/manifest/button',
      '/example-src/button/basic',
    ];

    for (const path of representativePaths) {
      expect(matchesAnyRewrite(path, sources), `no rewrite covers ${path}`).toBe(true);
    }
  });
});

describe('api/index.ts (Vercel function entry)', () => {
  it('default-exports a Web Standard { fetch } handler', async () => {
    const entry = await import('./index.ts');
    expect(typeof entry.default).toBe('object');
    expect(typeof entry.default.fetch).toBe('function');
  });

  it('delegates /ping to the real handler (proves the wiring, not a stub)', async () => {
    const entry = await import('./index.ts');
    const response = await entry.default.fetch(new Request('http://localhost/ping'));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });
});

/**
 * Test-local matcher for Vercel's `:param` / `:param*` rewrite syntax. Vercel
 * uses `path-to-regexp`; this re-implements just enough to assert coverage:
 * `:name` matches a single non-slash segment, `:path*` matches zero-or-more
 * segments, and a literal `.` is matched literally. A static source matches
 * only itself. Built left-to-right so each token is translated exactly once,
 * avoiding the escape/unescape ambiguity around `*`.
 */
function matchesAnyRewrite(pathname: string, sources: string[]): boolean {
  return sources.some((source) => {
    let pattern = '';
    let index = 0;
    while (index < source.length) {
      const character = source[index]!;
      if (character === ':') {
        const rest = source.slice(index + 1);
        const greedy = /^[A-Za-z0-9_]+\*/.exec(rest); // :path* → any depth
        const single = /^[A-Za-z0-9_]+/.exec(rest); //  :name  → one segment
        if (greedy) {
          pattern += '.*';
          index += 1 + greedy[0].length;
          continue;
        }
        if (single) {
          pattern += '[^/]+';
          index += 1 + single[0].length;
          continue;
        }
      }
      // Everything else is a literal — escape regex metacharacters (notably `.`).
      pattern += character.replace(/[.*+?^${}()|[\]\\]/, (ch) => `\\${ch}`);
      index += 1;
    }
    return new RegExp(`^${pattern}$`).test(pathname);
  });
}
