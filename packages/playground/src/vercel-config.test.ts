/**
 * Tests for the Vercel deployment configuration.
 *
 * The playground deploys to Vercel as a **pure static site**. The dev server
 * compiles Svelte/TS on the fly, which works at build time but cannot run in a
 * serverless function (the bundled Lambda can't resolve the dev-toolchain
 * module graph). So `scripts/static-export.ts` pre-renders every route to
 * `public/` at build time and Vercel serves those static files — no function,
 * no rewrites table, no runtime compilation.
 *
 * These tests pin that contract so it can't silently regress back into a
 * function-based deploy (which 500s) or lose the static-output wiring.
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
  it('is valid JSON configured for a static-output deploy', async () => {
    const config = await readVercelConfig();
    expect(config['$schema']).toBe('https://openapi.vercel.sh/vercel.json');
    // No meta-framework: we publish a pre-rendered directory.
    expect(config['framework']).toBeNull();
    expect(config['buildCommand']).toBe('bun run vercel-build');
    // Static export bundles workspace source at build time, so Vercel must not
    // prune devDependencies before running the build.
    expect(config['installCommand']).toContain('NODE_ENV=development bun install');
    // The pre-rendered site lives in public/.
    expect(config['outputDirectory']).toBe('public');
    // cleanUrls serves `public/c/button/index.html` at the clean `/c/button`.
    expect(config['cleanUrls']).toBe(true);
  });

  it('ships NO serverless function — the dev toolchain must not reach the Lambda', async () => {
    const config = await readVercelConfig();
    // A `functions` entry would try to deploy the on-the-fly-build server, which
    // 500s at runtime (FUNCTION_INVOCATION_FAILED). The static export exists
    // precisely to avoid that, so the config must not declare one.
    expect(config['functions']).toBeUndefined();
    // And there must be no api/ function directory left behind.
    expect(await Bun.file(join(PLAYGROUND_ROOT, 'api', 'index.ts')).exists()).toBe(false);
  });

  it('builds the static site via scripts/static-export.ts', async () => {
    // The `vercel-build` script (run by vercel.json's buildCommand) must run the
    // pre-render directly.
    const manifest = (await Bun.file(join(PLAYGROUND_ROOT, 'package.json')).json()) as {
      scripts: Record<string, string>;
    };
    const vercelBuild = manifest.scripts['vercel-build'] ?? '';
    expect(vercelBuild).toContain("bun run --filter='@cinder/diff' build");
    expect(vercelBuild).toContain("bun run --filter='@cinder/markdown' build");
    expect(vercelBuild).toContain("bun run --filter='@cinder/editor' build");
    expect(vercelBuild).toContain("bun run --filter='@cinder/commentary' build");
    expect(vercelBuild).toContain('scripts/static-export.ts');
    // The export must exist and drive the real server handler.
    const exportScript = await Bun.file(
      join(PLAYGROUND_ROOT, 'scripts', 'static-export.ts'),
    ).text();
    expect(exportScript).toContain('handleRequest');
    expect(exportScript).toContain('playground-server.ts');
  });

  it('keeps the server module out of Vercel backend-entrypoint auto-detection', async () => {
    // Even though we ship no function today, a module named
    // server/index/app/main in root or src/ would make Vercel auto-detect a Bun
    // backend root entrypoint and try to RUN it — re-introducing the runtime
    // failure the static export avoids. Pin the module name out of that set.
    const serverModule = Bun.file(join(PLAYGROUND_ROOT, 'src', 'playground-server.ts'));
    expect(await serverModule.exists()).toBe(true);
    const legacy = Bun.file(join(PLAYGROUND_ROOT, 'src', 'server.ts'));
    expect(await legacy.exists()).toBe(false);
  });
});
