// CANONICAL SOURCE for `atomicSwapDist`. The four upstream packages
// (diff, markdown, editor, commentary) each carry a byte-identical copy at
// `packages/<pkg>/scripts/lib/atomic-swap-dist.ts` because a cross-package
// import would break their `rootDir: "."` typecheck constraint. Keep all copies
// in sync — if you change this, change theirs too.
import { renameSync, rmSync } from 'node:fs';

/**
 * Atomically install `tempDirectory` as `distributionDirectory`, handling
 * concurrent same-package builds safely.
 *
 * Strategy:
 *   1. Try rename(temp, dist). On first build (no dist) or if dist is absent,
 *      this succeeds atomically and we're done.
 *   2. If dist already exists (ENOTEMPTY from rename(2)), vacate it:
 *      rename(dist, old). If dist vanished between step 1 and now (a concurrent
 *      winner moved it away), the ENOENT here means the winner already installed
 *      a complete dist — our result is redundant; clean up temp and succeed.
 *   3. With dist now vacated, try rename(temp, dist). If this fails, a
 *      concurrent winner raced us and installed dist after we moved old away.
 *      Either way, dist is complete; clean up temp (and old, which we own) and
 *      succeed.
 *   4. We own the installed dist. Delete old.
 *
 * The exit handler registered here removes temp and old so no litter survives
 * a crash at any point in the swap sequence.
 *
 * @param tempDirectory - Completed build output (e.g. `dist.tmp-<pid>`).
 * @param distributionDirectory - Final destination (e.g. `dist/`).
 */
export function atomicSwapDist(tempDirectory: string, distributionDirectory: string): void {
  const oldDirectory = `${distributionDirectory}.old-${process.pid}`;

  // Ensure temp and old are cleaned up even if the process exits mid-swap.
  process.on('exit', () => {
    rmSync(tempDirectory, { recursive: true, force: true });
    rmSync(oldDirectory, { recursive: true, force: true });
  });

  // Step 1: optimistic path — first build or dist is absent.
  try {
    renameSync(tempDirectory, distributionDirectory);
    return;
  } catch {
    // dist already exists (ENOTEMPTY) or another transient error. Fall through
    // to the vacate-and-reinstall path.
  }

  // Step 2: vacate dist → old so we can install our temp.
  try {
    renameSync(distributionDirectory, oldDirectory);
  } catch {
    // dist disappeared between step 1 and now: a concurrent winner already
    // swapped in a complete dist. Our build output is redundant.
    // temp is cleaned by the exit handler. Succeed.
    return;
  }

  // Step 3: install our build as the new dist.
  try {
    renameSync(tempDirectory, distributionDirectory);
  } catch {
    // A concurrent winner installed dist after we vacated it. dist is complete.
    // We own old — clean it up. temp is cleaned by the exit handler. Succeed.
    rmSync(oldDirectory, { recursive: true, force: true });
    return;
  }

  // Step 4: we successfully installed dist. Remove the vacated old tree.
  rmSync(oldDirectory, { recursive: true, force: true });
}
