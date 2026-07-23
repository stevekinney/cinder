// CANONICAL SOURCE for `buildCache`. This file lives under `components`; the
// three upstream packages (diff, markdown, editor) each carry a
// byte-identical copy at `packages/<pkg>/scripts/lib/build-cache.ts` — four
// copies total. The duplication exists for the same reason
// `atomic-swap-dist.ts` is duplicated: each package's tsconfig has
// `rootDir: "."`, so a cross-package import would put a source file outside
// that package's root and break its typecheck. Keep all four copies in sync:
// `build-cache.duplication.test.ts` asserts they are byte-for-byte identical,
// so drift fails the suite.
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * The name of the marker file written inside `dist/` after a successful
 * build, recording the content hash of the inputs that produced it. Its
 * presence (and matching value) is what lets a subsequent invocation skip
 * rebuilding entirely.
 */
export const BUILD_INPUT_HASH_MARKER = '.build-input-hash';

/**
 * Environment variable that forces a rebuild regardless of hash match. Set by
 * a caller (or a human) to bypass the skip check when it is under suspicion.
 */
const FORCE_BUILD_ENV_VAR = 'CINDER_FORCE_BUILD';

/** The slice of `node:fs/promises` this helper uses, injectable for tests. */
type DirectoryReader = typeof readdir;

/**
 * Inputs that determine a package build's output. Callers assemble this from
 * their own package layout:
 *   - `packageRoot` — absolute path to the package directory (`process.cwd()`
 *     when invoked via `bun run`).
 *   - `sourceGlobRoots` — absolute directory paths to hash recursively (every
 *     file under each, sorted by path). Typically `src` plus `scripts`.
 *   - `extraFiles` — absolute paths to individual files to hash (package.json,
 *     tsconfig*.json, and anything else outside `sourceGlobRoots` that affects
 *     output, e.g. a generated manifest at the package root).
 *   - `upstreamDistDirectories` — absolute paths to `dist/` directories of
 *     workspace dependencies this package vendors or type-checks against. A
 *     rebuilt dependency changes these bytes, which changes this hash, which
 *     invalidates this package — the mechanism that makes the skip check safe
 *     across the diff → markdown → editor chain (and
 *     components, which vendors all three).
 */
export type BuildCacheInputs = {
  packageRoot: string;
  sourceGlobRoots: string[];
  extraFiles: string[];
  upstreamDistDirectories: string[];
};

/** Narrow an unknown caught value to Node's errno-bearing error shape. */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Recursively collect every file path under `root`, sorted. Sorting makes the
 * hash independent of filesystem readdir order, which is not guaranteed
 * stable across platforms or runs.
 */
async function collectFilesSorted(root: string, readDirectory: DirectoryReader): Promise<string[]> {
  if (!existsSync(root)) return [];
  const entries = await readDirectory(root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
  files.sort();
  return files;
}

/**
 * Compute a stable content hash of everything that determines a package
 * build's output: its own source tree(s), config files, the build script
 * itself, and the vendored dist bytes of any upstream workspace dependencies.
 * Deterministic — same inputs always produce the same hash, regardless of
 * filesystem enumeration order or process environment.
 *
 * Hashing failures (a listed file vanishing mid-read, a permission error)
 * propagate to the caller rather than being swallowed here — `shouldSkipBuild`
 * treats any thrown error as "cannot prove up to date," which means build.
 *
 * @param readDirectory - `fs/promises.readdir`, injectable for tests.
 */
export async function computeBuildInputHash(
  inputs: BuildCacheInputs,
  readDirectory: DirectoryReader = readdir,
): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  const labeledFiles: Array<{ absolute: string; label: string }> = [];
  for (const root of inputs.sourceGlobRoots) {
    const files = await collectFilesSorted(root, readDirectory);
    for (const absolute of files) {
      labeledFiles.push({ absolute, label: `root:${relative(inputs.packageRoot, absolute)}` });
    }
  }
  const extraFiles = [...inputs.extraFiles];
  extraFiles.sort();
  for (const absolute of extraFiles) {
    labeledFiles.push({ absolute, label: `file:${relative(inputs.packageRoot, absolute)}` });
  }
  const upstreamDistDirectories = [...inputs.upstreamDistDirectories];
  upstreamDistDirectories.sort();
  for (const distDirectory of upstreamDistDirectories) {
    const files = await collectFilesSorted(distDirectory, readDirectory);
    for (const absolute of files) {
      labeledFiles.push({
        absolute,
        label: `upstream:${distDirectory}:${relative(distDirectory, absolute)}`,
      });
    }
  }

  // Sort the fully-labeled list once more so the three sources above interleave
  // deterministically rather than being hashed source-group-by-source-group
  // (irrelevant for correctness, but keeps the hash stable if a caller ever
  // reorders `sourceGlobRoots` / `extraFiles` / `upstreamDistDirectories`).
  labeledFiles.sort((a, b) => a.label.localeCompare(b.label));

  for (const { absolute, label } of labeledFiles) {
    const bytes = await Bun.file(absolute).bytes();
    hasher.update(label);
    hasher.update('\0');
    hasher.update(bytes);
    hasher.update('\0');
  }

  return hasher.digest('hex');
}

/**
 * Read the previously-recorded input hash from `dist/<marker>`, or `null` if
 * it is missing, unreadable, or malformed. Never throws — a missing/bad
 * marker is exactly the "cannot prove up to date" case callers should treat as
 * "build."
 */
async function readRecordedHash(distributionDirectory: string): Promise<string | null> {
  const markerPath = join(distributionDirectory, BUILD_INPUT_HASH_MARKER);
  const file = Bun.file(markerPath);
  try {
    if (!(await file.exists())) return null;
    const contents = await file.text();
    const text = contents.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Result of a skip check: either skip (with the matched hash) or build. */
export type BuildCacheDecision =
  | { skip: true; hash: string }
  | { skip: false; hash: string | null; reason: string };

/**
 * Decide whether a build can be skipped: compute the current input hash and
 * compare it against the marker recorded in `dist/` by the last successful
 * build. On ANY doubt — missing marker, hash-computation error, or the
 * `CINDER_FORCE_BUILD=1` escape hatch — this returns `skip: false` rather than
 * risk serving stale output.
 *
 * Callers that get `skip: true` should log the returned hash and exit 0
 * immediately, without running the build. Callers that get `skip: false`
 * should proceed to build, then call `writeBuildInputHash` with the SAME
 * `hash` this function returns (recomputing it is wasted work, and — worse —
 * a second computation could observe a different filesystem state) only after
 * every build step succeeds.
 */
export async function shouldSkipBuild(
  inputs: BuildCacheInputs,
  readDirectory: DirectoryReader = readdir,
): Promise<BuildCacheDecision> {
  const forceBuild = process.env['CINDER_FORCE_BUILD'] === '1';

  const distributionDirectory = join(inputs.packageRoot, 'dist');
  const recorded = await readRecordedHash(distributionDirectory);

  // Compute the input hash NOW — before the build reads any source — even when
  // forcing. The caller records THIS pre-build hash after a successful build;
  // recomputing post-build could observe sources mutated mid-build (a save
  // after the compiler already read them) and stamp output with a hash it was
  // not produced from, letting a later build wrongly skip stale `dist`.
  let currentHash: string;
  try {
    currentHash = await computeBuildInputHash(inputs, readDirectory);
  } catch (error) {
    const message = isErrnoException(error) ? (error.code ?? error.message) : String(error);
    return { skip: false, hash: null, reason: `hash computation failed (${message})` };
  }

  // The escape hatch refuses to SKIP, but still returns the pre-build hash so
  // the forced rebuild records an accurate marker.
  if (forceBuild) {
    return { skip: false, hash: currentHash, reason: `${FORCE_BUILD_ENV_VAR}=1 set` };
  }

  if (recorded === null) {
    return { skip: false, hash: currentHash, reason: 'no recorded build-input hash' };
  }
  if (recorded !== currentHash) {
    return { skip: false, hash: currentHash, reason: 'inputs changed' };
  }
  return { skip: true, hash: currentHash };
}

/**
 * Record `hash` as the input hash for the build that just completed. Callers
 * MUST call this only after the build's output has been fully and
 * successfully promoted into `distributionDirectory` (e.g. after
 * `atomicSwapDist` returns, or — for a package that builds in place — after
 * every acceptance check has passed), so the marker never claims a
 * half-written or failed build is up to date.
 */
export async function writeBuildInputHash(
  distributionDirectory: string,
  hash: string,
): Promise<void> {
  await Bun.write(join(distributionDirectory, BUILD_INPUT_HASH_MARKER), `${hash}\n`);
}

/** First 12 hex characters of a hash, for a readable log line. */
export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}
