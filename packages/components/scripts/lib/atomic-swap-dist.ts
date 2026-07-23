// CANONICAL SOURCE for `atomicSwapDist`. This file lives under `components`;
// the three upstream packages (diff, markdown, commentary) each carry a
// byte-identical copy at `packages/<pkg>/scripts/lib/atomic-swap-dist.ts` — four
// copies total. The duplication exists because a cross-package import would put
// a source file outside that package's `rootDir: "."` and break its typecheck.
// A `paths` mapping does not lift that restriction — only a built/referenced
// project would, which is heavier than the duplication. Keep all four copies in
// sync: `atomic-swap-dist.duplication.test.ts` asserts they are byte-for-byte
// identical, so drift fails the suite.
import { renameSync, rmSync } from 'node:fs';

/** The slice of `node:fs` this helper uses. Defaulted to the real functions in
 * `atomicSwapDist`; tests pass a fake to drive the concurrent-race branches that
 * serial real-filesystem calls cannot reach. This is the helper's only test
 * seam — deliberately just the two operations it performs, not a config bag. */
type FileSystemOperations = {
  renameSync: typeof renameSync;
  rmSync: typeof rmSync;
};

/** Narrow an unknown caught value to Node's errno-bearing error shape. */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/** rename(2) reports "destination already exists and is a non-empty directory"
 * as ENOTEMPTY on Linux and EEXIST on macOS. Both mean the same benign thing
 * here: someone else owns `dist`. */
const DESTINATION_EXISTS_CODES = new Set(['ENOTEMPTY', 'EEXIST']);

/**
 * Promote a completed staging build into `distributionDirectory`, surviving a
 * concurrent same-package build (`bun run --filter=<pkg> build` invoked by
 * turbo, CI, or by hand at the same time as another).
 *
 * IMPORTANT — what this does and does NOT guarantee:
 *   - This is the correctness boundary for concurrent builds. Git hooks do not
 *     serialize build work, so every caller relies on the atomic promotion.
 *   - It DOES prevent a reader from observing a half-written tree: a build
 *     writes into a private staging dir and is only promoted once complete, so
 *     `dist` is replaced whole, never written into in place.
 *   - It does NOT guarantee `dist` is continuously present. In the rebuild
 *     path there is a sub-millisecond window between vacating the live tree and
 *     installing the new one where `dist` does not exist, so a concurrent
 *     reader can still observe a transient ENOENT. Eliminating that would need
 *     a symlink-pointer scheme, which consumers that resolve `dist/...` paths
 *     directly cannot tolerate — out of scope here.
 *
 * Preconditions:
 *   - `tempDirectory` and `distributionDirectory` MUST be on the same
 *     filesystem; `rename(2)` fails with EXDEV across devices. Callers build
 *     the staging dir as a sibling of `dist` under the package root, so this
 *     holds. EXDEV is therefore re-thrown, not swallowed.
 *   - `tempDirectory` should be uniquely named per invocation (see
 *     `stagingDirectoryName`) so two concurrent builds never collide on it.
 *
 * Strategy (only the EXPECTED race errors are swallowed; everything else
 * re-throws so a genuine failure can never masquerade as a successful build):
 *   1. rename(temp, dist). Succeeds on first build (no dist). If dist exists
 *      (ENOTEMPTY / EEXIST), fall through; any other error re-throws.
 *   2. Vacate: rename(dist, old). If dist vanished (ENOENT) a concurrent build
 *      already installed a complete dist — ours is redundant, return; any other
 *      error re-throws.
 *   3. Install: rename(temp, dist). If dist now exists (ENOTEMPTY / EEXIST) a
 *      concurrent build raced in after we vacated — its dist is complete; drop
 *      our `old` and return. On any OTHER error we best-effort roll back —
 *      rename(old, dist) to restore the last good build — then re-throw the
 *      original error. (Without the rollback, a failed install would leave the
 *      package with no `dist` at all, since the only copy is in `old`.)
 *   4. We own the installed dist. Remove the vacated `old` tree.
 *
 * @returns `true` when THIS call installed its own staging tree as the live
 *   `dist` (steps 1 and 4); `false` when a concurrent same-package build's dist
 *   won and this call's staging tree was discarded (steps 2 and 3 race paths).
 *   Callers use this to avoid stamping their own build-cache marker onto a
 *   `dist` another build produced from potentially different inputs — only the
 *   build that actually installed a tree may record its input hash for it.
 *
 * The success and concurrent-loser paths remove `temp` / `old` synchronously
 * before returning. A `process.on('exit')` handler is also registered as a
 * backstop that removes the staging tree (`temp`) if the process exits between
 * two rename steps — but it runs on normal exit and `process.exit()` only, NOT
 * on SIGKILL/SIGINT, so a hard kill mid-swap can still leave a `dist.tmp-*` /
 * `dist.old-*` sibling behind. Those names are gitignored, so such litter never
 * reaches version control. The handler deliberately never deletes `old`:
 * between step 2 and step 4 it is the last good build, and the step-3 rollback
 * relies on it surviving.
 *
 * @param tempDirectory - Completed, validated build output to promote.
 * @param distributionDirectory - Final destination (e.g. `dist/`).
 * @param fileSystem - The `renameSync` / `rmSync` pair to use. Defaults to the
 *   real `node:fs`; tests inject a fake to exercise the concurrent-race branches
 *   that serial real-filesystem calls cannot reach. Not a production knob.
 */
export function atomicSwapDist(
  tempDirectory: string,
  distributionDirectory: string,
  fileSystem: FileSystemOperations = { renameSync, rmSync },
): boolean {
  // Unique per invocation so two concurrent builds (different pid OR same pid
  // reused across non-overlapping runs) never collide on, or clean up, each
  // other's vacated tree.
  const oldDirectory = `${distributionDirectory}.old-${stagingSuffix()}`;

  // Best-effort cleanup of the staging tree THIS call owns, on normal exit only.
  // The handler deliberately does NOT touch `oldDirectory`: after step 2 vacates
  // the live tree there, `oldDirectory` is the ONLY copy of the last good build
  // until step 4 (success) or the step-3 loser path removes it synchronously. If
  // step 3 fails unexpectedly we restore from it (see below); deleting it here
  // would destroy the last good build on that failure path. Every safe path
  // already removes `oldDirectory` synchronously, so the handler has no reason
  // to — leaving a `dist.old-*` sibling behind on a hard exit is the safe choice.
  process.on('exit', () => {
    fileSystem.rmSync(tempDirectory, { recursive: true, force: true });
  });

  // Step 1: optimistic — first build, or dist is absent.
  try {
    fileSystem.renameSync(tempDirectory, distributionDirectory);
    return true;
  } catch (error) {
    if (!isErrnoException(error) || !DESTINATION_EXISTS_CODES.has(error.code ?? '')) {
      throw error;
    }
    // dist exists — fall through to the vacate-and-install path.
  }

  // Step 2: vacate dist → old so we can install our staging tree.
  try {
    fileSystem.renameSync(distributionDirectory, oldDirectory);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      // dist vanished between step 1 and now: a concurrent build already
      // installed a complete dist. Ours is redundant — clean up our staging
      // tree now (don't lean on the exit handler, which won't fire on SIGKILL).
      fileSystem.rmSync(tempDirectory, { recursive: true, force: true });
      return false;
    }
    throw error;
  }

  // Step 3: install our staging tree as the new dist.
  try {
    fileSystem.renameSync(tempDirectory, distributionDirectory);
  } catch (error) {
    if (isErrnoException(error) && DESTINATION_EXISTS_CODES.has(error.code ?? '')) {
      // A concurrent build installed dist after we vacated it. Its dist is
      // complete; drop both the tree we vacated and our now-redundant staging
      // tree immediately rather than waiting for the exit handler.
      fileSystem.rmSync(oldDirectory, { recursive: true, force: true });
      fileSystem.rmSync(tempDirectory, { recursive: true, force: true });
      return false;
    }
    // Unexpected install failure (ENOSPC / EIO / EPERM / …) after we already
    // vacated the live tree to `oldDirectory`. Best-effort rollback: move the
    // last good build back into place so the package is left buildable, then
    // re-throw the ORIGINAL error so the failure still surfaces. The rollback is
    // intentionally swallowed — if it fails (e.g. a concurrent build installed a
    // complete dist in the gap, giving ENOTEMPTY/EEXIST), that build's tree is
    // the valid one and ours is redundant; either way we must not mask the
    // original error or delete `oldDirectory` (it may still be the last good
    // build).
    try {
      fileSystem.renameSync(oldDirectory, distributionDirectory);
    } catch {
      // Rollback failed; preserve `oldDirectory` and the original error.
    }
    throw error;
  }

  // Step 4: we installed dist. Remove the vacated old tree.
  fileSystem.rmSync(oldDirectory, { recursive: true, force: true });
  return true;
}

/**
 * A collision-resistant suffix for staging / old directory names: process id,
 * high-resolution-ish wall clock, and a random tail. Unique enough that two
 * concurrent builds — even same-pid across non-overlapping runs — never share a
 * staging or vacated-tree name. Build scripts may use `Date.now()` /
 * `Math.random()` freely (this is not a deterministic-replay context).
 */
function stagingSuffix(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build the per-invocation staging directory name a caller should emit into
 * before calling `atomicSwapDist`. Returned as a bare name (no leading path) so
 * it can be passed straight to `tsc --outDir ./<name>` and joined onto the
 * package root for `Bun.build`'s `outdir`.
 */
export function stagingDirectoryName(): string {
  return `dist.tmp-${stagingSuffix()}`;
}
