import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  PUBLIC_PATH_BY_FAMILY,
  SHARED_BUILD_OPTIONS,
  collectBuildArtifacts,
  shellArtifactByPath,
} from './build-artifacts-shared.ts';
import { getRebuildGeneration, isShellStale, setShellStale } from './file-watcher.ts';
import { PLAYGROUND_TEMP_ROOT } from './playground-paths.ts';

/**
 * Shell-bundle entries: keyed by logical name → entry artifact path. There's
 * currently exactly one shell bundle (`'shell'`), but the map shape mirrors
 * the page-bundle map for symmetry and lets the cache-state machine publish
 * atomically per family.
 */
export const shellEntryByName = new Map<string, string>();

export type ShellBuildResult = { code: string | null; usedFallback: boolean };

/**
 * In-flight lazy-build promise for the shell bundle — a single slot (there's
 * only ever one shell bundle), unlike the other families' `Map`-based dedup.
 * Lives here (not `build-artifacts-shared.ts`) because both reads AND writes
 * of this slot happen from within `buildShellBundle` in this file; the one
 * external write (`invalidateCachesForChange`'s unconditional reset) goes
 * through {@link resetShellBuildPromise} rather than reassigning the binding
 * directly, since an imported `let` binding cannot be reassigned from another
 * module.
 */
let shellBuildPromise: Promise<ShellBuildResult> | null = null;

/** Reset the in-flight shell build slot. Called by `invalidateCachesForChange`. */
export function resetShellBuildPromise(): void {
  shellBuildPromise = null;
}

/**
 * Compile the playground shell SPA bundle without mutating cache state.
 *
 * Compiles `shell-app/shell-entry.ts` (which imports `shell.svelte`) into a
 * single ESM bundle using the same `SHARED_BUILD_OPTIONS` + Svelte plugin
 * configuration as the page-bundle family. The entry uses a `shell-` basename
 * prefix so the entry key is disjoint from `page-*` and `bundle-*`.
 *
 * Returns the entry path/code and every emitted artifact, or `null` on
 * build failure. The caller decides whether to publish into shared caches.
 */
export async function compileShellBundleArtifacts(): Promise<{
  entryPath: string;
  entryCode: string;
  artifacts: Map<string, string>;
} | null> {
  const entryBasename = 'shell-shell';
  const entryTempDir = join(PLAYGROUND_TEMP_ROOT, randomUUID());
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);
  // Side-effect import: `shell-entry.ts` calls `mount(Shell, ...)` at module
  // top level and exports nothing. `export {} from` is a re-export of named
  // bindings and is eligible for tree-shaking when the source exports no
  // names; a bare side-effect import preserves the module's evaluation.
  const shim = `import '../../src/shell-app/shell-entry.ts';\n`;

  try {
    await Bun.write(entryTempPath, shim);

    const result = await Bun.build({
      entrypoints: [entryTempPath],
      publicPath: PUBLIC_PATH_BY_FAMILY.shell,
      ...SHARED_BUILD_OPTIONS,
    });

    if (!result.success) {
      console.error('[playground] shell bundle failed:', result.logs);
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error('[playground] shell bundle produced no entry chunk');
      return null;
    }

    return entry;
  } finally {
    rmSync(entryTempDir, { recursive: true, force: true });
  }
}

/**
 * Lazy-build wrapper: compile the shell bundle and publish into shared
 * caches. Used by `/shell-bundle/shell.js` as a fallback when the shell
 * bundle isn't already cached, or when the shell is marked stale. Same
 * race-discipline as `buildPageBundle` (see the doc-comment there): skip the
 * entry-name publish if an invalidation landed during the compile. De-dupes
 * concurrent callers via `shellBuildPromise` (a single slot — there's only
 * ever one shell bundle).
 *
 * Unlike `buildPageBundle`, a failed compile does NOT surface as a miss: it
 * falls back to the last-good cached shell (if any) instead — see
 * `shellStale`'s doc comment for why the shell specifically needs this.
 */
export async function buildShellBundle(): Promise<ShellBuildResult> {
  const cachedEntryPath = shellEntryByName.get('shell');
  const cachedCode =
    cachedEntryPath !== undefined ? shellArtifactByPath.get(cachedEntryPath) : undefined;
  if (cachedCode !== undefined && !isShellStale()) {
    return { code: cachedCode, usedFallback: false };
  }

  if (shellBuildPromise !== null) return shellBuildPromise;

  const buildPromise: Promise<ShellBuildResult> = (async () => {
    const generationAtStart = getRebuildGeneration();
    // A Svelte syntax error makes the underlying `Bun.build()` call THROW
    // rather than resolve with `{ success: false }` — `.catch()` converts
    // that into the same graceful-failure path as a build that resolves
    // unsuccessfully, so the fallback below actually runs instead of
    // rejecting past this function into an uncaught-exception 500.
    const entry = await compileShellBundleArtifacts().catch((error: unknown) => {
      console.error('[playground] shell rebuild threw:', error);
      return null;
    });
    if (entry === null) {
      console.error(
        '[playground] shell rebuild failed — serving last-good shell (if cached); will retry on next request',
      );
      return { code: cachedCode ?? null, usedFallback: true };
    }

    // Always publish chunks (see buildPageBundle's comment for the
    // rationale — the entry we're returning has static imports to
    // content-hashed chunks that must be servable).
    for (const [path, code] of entry.artifacts) shellArtifactByPath.set(path, code);
    if (generationAtStart === getRebuildGeneration()) {
      shellEntryByName.set('shell', entry.entryPath);
      setShellStale(false);
    }
    return { code: entry.entryCode, usedFallback: false };
  })();
  shellBuildPromise = buildPromise;

  try {
    return await buildPromise;
  } finally {
    // Only clear OUR OWN slot — see buildPageBundle's identical guard for
    // why an unconditional null-out would risk clobbering a newer build.
    if (shellBuildPromise === buildPromise) shellBuildPromise = null;
  }
}
