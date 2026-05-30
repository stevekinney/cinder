/**
 * Production build step for the cinder playground's Vercel deployment.
 *
 * The playground has no compiled output: every page and bundle is built on the
 * fly by the `src/server.ts` Bun Function (the Vercel root entrypoint) at
 * request time (see that file and `vercel.json`). So this "build" does two
 * cheap, deploy-protecting things:
 *
 *   1. Smoke-imports the function entry. Importing `src/server.ts` transitively
 *      loads the Svelte build plugin under `packages/components/scripts`. If
 *      any of that fails to evaluate — a
 *      bad import path, a syntax error, a missing dependency — the build fails
 *      loudly here instead of 500-ing on the first live request.
 *   2. Materializes the `outputDirectory` that `vercel.json` points at
 *      (`public/`). A function-only deployment ships no static assets, but
 *      Vercel still expects the configured output directory to exist, so we
 *      create it with a single explanatory file.
 *
 * Run by the `vercel-build` script in `package.json`, which Vercel invokes via
 * the `buildCommand` in `vercel.json`.
 */

import { join } from 'node:path';

const PLAYGROUND_ROOT = join(import.meta.dirname, '..');
const OUTPUT_DIRECTORY = join(PLAYGROUND_ROOT, 'public');

/**
 * Import the Vercel Function entry to prove it (and everything it pulls in)
 * evaluates cleanly. Throws — failing the build — if the module graph is
 * broken. We import for side effects only; the default export is the live
 * handler, exercised by the smoke test, not at build time.
 */
async function verifyFunctionEntryLoads(): Promise<void> {
  const entry = await import('../src/server.ts');
  if (typeof entry.default?.fetch !== 'function') {
    throw new Error(
      '[playground:vercel-build] src/server.ts must default-export an object with a fetch() method (the Vercel Bun-runtime entrypoint)',
    );
  }
}

/**
 * Ensure the configured output directory exists with a placeholder README so
 * Vercel's static-output step has something to publish. The playground serves
 * nothing static, so this directory stays effectively empty.
 */
async function ensureOutputDirectory(): Promise<void> {
  await Bun.write(
    join(OUTPUT_DIRECTORY, 'README.txt'),
    [
      'This directory is intentionally (almost) empty.',
      '',
      'The cinder playground is served entirely by the Bun Function at',
      'src/server.ts (the Vercel root entrypoint), which builds every page and',
      'bundle on the fly. There are no pre-rendered static assets. This file',
      'exists only so the configured outputDirectory in vercel.json is present',
      'for Vercel to publish.',
      '',
    ].join('\n'),
  );
}

await verifyFunctionEntryLoads();
await ensureOutputDirectory();
process.stdout.write('[playground:vercel-build] function entry verified, output directory ready\n');
