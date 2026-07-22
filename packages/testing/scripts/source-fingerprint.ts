import { readdirSync, statSync, type Dirent } from 'node:fs';
import { join } from 'node:path';

/**
 * Directories whose newest file mtime feeds the playground server's startup
 * fingerprint. Relative to the repo root — both the playground server (which
 * computes its own fingerprint at startup) and `start-server.ts` (which
 * recomputes the expectation before deciding whether to reuse a running
 * server) resolve these against their own idea of the repo root.
 */
export const FINGERPRINT_SOURCE_DIRECTORIES = [
  'packages/playground/src',
  'packages/components/src',
  'packages/chat/src',
  // The playground server itself and its build helpers live under these
  // `scripts` trees (playground-server.ts imports e.g. components'
  // scripts/svelte-plugin.ts and scripts/lib/visual-fixtures/loader.ts). An
  // edit to the SERVER/bundler code must invalidate the fingerprint too, or a
  // running server with the old server code loaded looks fresh. Whole-dir
  // coverage over-refreshes on unrelated script edits, which is the safe
  // direction — a spurious rebuild costs seconds; a stale reuse silently tests
  // the wrong bytes.
  'packages/components/scripts',
  'packages/playground/scripts',
  // The playground server prebuilds these upstream workspaces plus the public
  // Cinder and Chat packages (see `playgroundBundleDependencyPackages` in
  // start-server.ts). The public packages already have source coverage above;
  // these upstream source trees must be listed explicitly too, or a running
  // server built from stale upstream code looks fresh.
  'packages/markdown/src',
  'packages/editor/src',
] as const;

/** Package metadata read by playground discovery, documentation, and bundling. */
export const FINGERPRINT_SOURCE_FILES = [
  'packages/playground/package.json',
  'packages/components/package.json',
  'packages/components/components.json',
  'packages/chat/package.json',
  'packages/chat/components.json',
] as const;

/**
 * Walk `directory` and return the newest file `mtimeMs` found anywhere in its
 * tree, or `null` if the directory does not exist or contains no files.
 */
export function newestFileMtimeMs(directory: string): number | null {
  let newest: number | null = null;
  const stack: string[] = [directory];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      // Skip dot-prefixed directories such as the playground server's
      // `.tmp-<uuid>` build scratch dirs (packages/playground/src/.tmp-*).
      // Those are removed in a `finally` block once a build finishes, but an
      // in-flight or orphaned-by-kill build could otherwise push the newest
      // mtime past the running server's own startup fingerprint and produce
      // a spurious "stale server" refusal.
      if (entry.isDirectory() && entry.name.startsWith('.')) continue;

      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const mtimeMs = statSync(fullPath).mtimeMs;
      if (newest === null || mtimeMs > newest) newest = mtimeMs;
    }
  }

  return newest;
}

/**
 * Compute the newest source mtime across every directory in
 * `FINGERPRINT_SOURCE_DIRECTORIES`, resolved against `repoRoot`.
 *
 * Returns `null` if none of the directories contain any files (should not
 * happen in a real checkout, but keeps this honest rather than returning `0`
 * and looking like a real timestamp).
 */
export function newestSourceMtimeMs(repoRoot: string): number | null {
  let newest: number | null = null;
  for (const relativeDirectory of FINGERPRINT_SOURCE_DIRECTORIES) {
    const candidate = newestFileMtimeMs(join(repoRoot, relativeDirectory));
    if (candidate !== null && (newest === null || candidate > newest)) newest = candidate;
  }
  for (const relativeFile of FINGERPRINT_SOURCE_FILES) {
    try {
      const candidate = statSync(join(repoRoot, relativeFile)).mtimeMs;
      if (newest === null || candidate > newest) newest = candidate;
    } catch {
      // A source package may be absent while a branch is being assembled.
    }
  }
  return newest;
}

/** JSON-serializable identity a playground server reports at startup. */
export type PlaygroundFreshnessFingerprint = {
  /** `Date.now()` when the server process started computing its fingerprint. */
  startedAtMs: number;
  /** Newest source `mtimeMs` across the fingerprinted directories at that time. */
  newestSourceMtimeMs: number | null;
};

/**
 * A running server is stale if the current source tree contains a file
 * newer than the newest file it saw when it started — i.e. something changed
 * on disk after that server process came up.
 */
export function isFingerprintStale(
  fingerprint: PlaygroundFreshnessFingerprint,
  currentNewestSourceMtimeMs: number | null,
): boolean {
  if (currentNewestSourceMtimeMs === null) return false;
  if (fingerprint.newestSourceMtimeMs === null) return true;
  return currentNewestSourceMtimeMs > fingerprint.newestSourceMtimeMs;
}
