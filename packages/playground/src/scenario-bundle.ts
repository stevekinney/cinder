import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  PUBLIC_PATH_BY_FAMILY,
  SHARED_BUILD_OPTIONS,
  collectBuildArtifacts,
  coordinatedBuild,
  scenarioArtifactByPath,
  scenarioBuildPromiseByKey,
} from './build-artifacts-shared.ts';
import { PLAYGROUND_ROOT, PLAYGROUND_TEMP_ROOT } from './playground-paths.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';

/**
 * Per-scenario bundle entries: keyed by "<name>/<scenario>" → entry
 * artifact path (e.g. "bundle-chat-basic.js").
 */
export const bundleEntryByKey = new Map<string, string>();

/**
 * Compile a per-scenario example bundle with code splitting enabled.
 *
 * Stores the entry artifact path in `bundleEntryByKey` and every artifact's
 * source in `scenarioArtifactByPath`. Returns the entry's compiled JS, or
 * null if the example file doesn't exist or the build fails.
 *
 * The entry is named `bundle-<componentName>-<scenario>.js` via a temp
 * entry file basename (Bun's `naming` template uses the entrypoint's
 * basename for `[name]`). This keeps it in a disjoint key-space from
 * page-bundle entries (`page-<name>.js`).
 */
export async function buildBundle(componentName: string, scenario: string): Promise<string | null> {
  const cacheKey = `${componentName}/${scenario}`;
  const cachedEntryPath = bundleEntryByKey.get(cacheKey);
  if (cachedEntryPath) {
    const cached = scenarioArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cached;
  }

  // De-dupe concurrent requests for the same not-yet-cached scenario bundle
  // (e.g. two browser tabs hitting the same freshly invalidated example)
  // into a single Bun.build() call.
  const existing = scenarioBuildPromiseByKey.get(cacheKey);
  if (existing !== undefined) return existing;

  const buildPromise = buildBundleUncached(componentName, scenario, cacheKey);
  scenarioBuildPromiseByKey.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    // Only remove OUR OWN entry — see buildPageBundle's identical guard for
    // why an unconditional delete would risk clobbering a newer build.
    if (scenarioBuildPromiseByKey.get(cacheKey) === buildPromise) {
      scenarioBuildPromiseByKey.delete(cacheKey);
    }
  }
}

async function buildBundleUncached(
  componentName: string,
  scenario: string,
  cacheKey: string,
): Promise<string | null> {
  const examplePath = join(
    PLAYGROUND_ROOT,
    'src',
    'examples',
    componentName,
    `${scenario}.example.svelte`,
  );
  const file = Bun.file(examplePath);
  const exists = await file.exists();
  if (!exists) return null;

  // Captured before the (potentially slow) compile so we can tell, after it
  // resolves, whether an invalidation raced past us — see the publish guard
  // below.
  const generationAtStart = getRebuildGeneration();

  // Bun's `naming` template uses the entrypoint basename for `[name]`. To
  // emit the entry as `bundle-<name>-<scenario>.js` (disjoint from the
  // page-bundle family's `page-<name>.js`) we write a tiny re-export shim
  // at exactly that basename. The shim lives under a UUID-tagged
  // subdirectory under `src/` so concurrent builds don't clobber each
  // other on disk; the basename itself stays stable so Bun's `[name]`
  // resolves predictably.
  const entryBasename = `bundle-${componentName}-${scenario}`;
  const entryTempDir = join(PLAYGROUND_TEMP_ROOT, randomUUID());
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);
  const shim = `export { default } from '../../src/examples/${componentName}/${scenario}.example.svelte';\n`;

  try {
    // Bun.write auto-creates parent directories. We keep the write inside
    // the try so a write failure still hits the finally cleanup (rmSync
    // is idempotent for a missing dir).
    await Bun.write(entryTempPath, shim);

    const result = await coordinatedBuild(() =>
      Bun.build({
        entrypoints: [entryTempPath],
        publicPath: PUBLIC_PATH_BY_FAMILY.scenario,
        ...SHARED_BUILD_OPTIONS,
      }),
    );

    if (!result.success) {
      console.error(`[playground] Bundle failed for ${componentName}/${scenario}:`, result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(`[playground] Bundle for ${componentName}/${scenario} produced no entry chunk`);
      return null;
    }

    // Chunk filenames are content-hashed, so publishing them is always safe
    // even if a newer invalidation raced past us — the bytes are identical.
    for (const [path, code] of entry.artifacts) scenarioArtifactByPath.set(path, code);
    // Only publish the entry pointer when we're not racing a newer
    // invalidation. Without this guard, a build that straddles an
    // invalidation would resurrect a stale `bundleEntryByKey` entry right
    // after `invalidateCachesForChange` cleared it.
    if (generationAtStart === getRebuildGeneration()) {
      bundleEntryByKey.set(cacheKey, entry.entryPath);
    }
    return entry.entryCode;
  } finally {
    // Recursive remove handles intermediate files Bun might emit and is
    // idempotent if the dir was never created.
    rmSync(entryTempDir, { recursive: true, force: true });
  }
}
