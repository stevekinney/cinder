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
