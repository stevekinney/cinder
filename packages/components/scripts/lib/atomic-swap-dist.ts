// CANONICAL SOURCE for `atomicSwapDist`. The four upstream packages
// (diff, markdown, editor, commentary) each carry a byte-identical copy at
// `packages/<pkg>/scripts/lib/atomic-swap-dist.ts` because a cross-package
// import would put a source file outside that package's `rootDir: "."` and
// break its typecheck. A `paths` mapping does not lift that restriction — only
// a built/referenced project would, which is heavier than the duplication.
// Keep all copies in sync: `atomic-swap-dist.duplication.test.ts` asserts they
// are byte-for-byte identical, so drift fails the suite.
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
 *   - It is NOT what closes issue #364. The husky test gate serializes its test
 *     phase (`phaseMaxConcurrency('test') === 1`), so concurrent same-package
 *     builds do not occur inside the hook; that serialization is the #364
 *     closure. This helper is defense-in-depth for the out-of-hook paths.
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
 *      our `old` and return; any other error re-throws.
 *   4. We own the installed dist. Remove the vacated `old` tree.
 *
 * The success and concurrent-loser paths remove `temp` / `old` synchronously
 * before returning. A `process.on('exit')` handler is also registered as a
 * backstop for the case where the process exits between two rename steps — but
 * it runs on normal exit and `process.exit()` only, NOT on SIGKILL/SIGINT, so a
 * hard kill mid-swap can still leave a `dist.tmp-*` / `dist.old-*` sibling
 * behind. Those names are gitignored, so such litter never reaches version
 * control.
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
): void {
  // Unique per invocation so two concurrent builds (different pid OR same pid
  // reused across non-overlapping runs) never collide on, or clean up, each
  // other's vacated tree.
  const oldDirectory = `${distributionDirectory}.old-${stagingSuffix()}`;

  // Best-effort cleanup of the dirs THIS call owns, on normal exit only.
  process.on('exit', () => {
    fileSystem.rmSync(tempDirectory, { recursive: true, force: true });
    fileSystem.rmSync(oldDirectory, { recursive: true, force: true });
  });

  // Step 1: optimistic — first build, or dist is absent.
  try {
    fileSystem.renameSync(tempDirectory, distributionDirectory);
    return;
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
      return;
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
      return;
    }
    throw error;
  }

  // Step 4: we installed dist. Remove the vacated old tree.
  fileSystem.rmSync(oldDirectory, { recursive: true, force: true });
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
