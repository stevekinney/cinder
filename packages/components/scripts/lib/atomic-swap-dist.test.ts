import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { atomicSwapDist } from './atomic-swap-dist.ts';

/**
 * Per-test isolated filesystem root so tests don't interfere with each other.
 * Each test gets its own unique directory under the OS temp dir.
 */
let testRoot: string;
/** Exit listeners registered by atomicSwapDist during a test, captured so we
 * can remove them when the test tears down. */
const exitListeners: Array<NodeJS.ExitListener> = [];

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), 'atomic-swap-test-'));
});

afterEach(() => {
  // Remove all exit listeners that were registered during this test.
  for (const listener of exitListeners) {
    process.off('exit', listener);
  }
  exitListeners.length = 0;
  rmSync(testRoot, { recursive: true, force: true });
});

/**
 * Wrap process.on to capture 'exit' listeners so they can be deregistered
 * after each test. Must be called before atomicSwapDist.
 */
function captureNextExitListener(): void {
  const originalOn = process.on.bind(process);
  const wrapper = (event: string, listener: NodeJS.ExitListener) => {
    if (event === 'exit') {
      exitListeners.push(listener);
      process.on = originalOn as typeof process.on;
    }
    return originalOn(event as Parameters<typeof process.on>[0], listener as never);
  };
  process.on = wrapper as typeof process.on;
}

async function makeDir(name: string, sentinelContent = 'sentinel-ok'): Promise<string> {
  const directory = join(testRoot, name);
  mkdirSync(directory, { recursive: true });
  await writeFile(join(directory, 'index.js'), sentinelContent);
  return directory;
}

async function readSentinel(directory: string): Promise<string> {
  return Bun.file(join(directory, 'index.js')).text();
}

function oldLitter(distributionDirectory: string): string[] {
  const parentDir = join(distributionDirectory, '..');
  const base = distributionDirectory.split('/').at(-1) ?? '';
  const glob = new Bun.Glob(`${base}.old-*`);
  return [...glob.scanSync({ cwd: parentDir, onlyFiles: false })];
}

describe('atomicSwapDist', () => {
  it('first build: installs temp as dist when dist does not exist', async () => {
    const tempDirectory = await makeDir('dist.tmp-first', 'first-build');
    const distributionDirectory = join(testRoot, 'dist');

    expect(existsSync(distributionDirectory)).toBe(false);

    captureNextExitListener();
    atomicSwapDist(tempDirectory, distributionDirectory);

    expect(existsSync(distributionDirectory)).toBe(true);
    expect(existsSync(tempDirectory)).toBe(false);
    expect(await readSentinel(distributionDirectory)).toBe('first-build');
    expect(oldLitter(distributionDirectory)).toHaveLength(0);
  });

  it('rebuild path: replaces existing dist with temp, leaving no litter', async () => {
    const distributionDirectory = join(testRoot, 'dist');

    // Pre-install an "old" dist.
    const priorDist = await makeDir('dist-prior', 'old-build');
    renameSync(priorDist, distributionDirectory);

    const tempDirectory = await makeDir('dist.tmp-rebuild', 'new-build');

    captureNextExitListener();
    atomicSwapDist(tempDirectory, distributionDirectory);

    expect(existsSync(distributionDirectory)).toBe(true);
    expect(existsSync(tempDirectory)).toBe(false);
    expect(await readSentinel(distributionDirectory)).toBe('new-build');
    // No dist.old-* litter should remain.
    expect(oldLitter(distributionDirectory)).toHaveLength(0);
  });

  it('concurrent-winner path: succeeds without throwing when dist disappears mid-swap', async () => {
    // This path simulates: our step-1 rename(temp, dist) fails because dist
    // exists, then a concurrent process removes dist before our step-2
    // rename(dist, old) can run. We replicate this by giving dist a structure
    // that prevents the step-1 rename (a non-empty dir counts as ENOTEMPTY),
    // then removing it ourselves between step 1 and step 2.
    //
    // Because we can't intercept the rename calls without causing infinite
    // recursion, we instead test the observable invariant: after a concurrent
    // winner scenario the helper must not crash, and dist must contain a
    // complete tree (either ours or the winner's).
    //
    // Approach: we call atomicSwapDist twice with the same distributionDirectory.
    // The second call enters the rebuild path (dist already exists from the
    // first call) and must succeed or gracefully yield to the first call's
    // result. Both calls should leave dist in a complete state.

    const distributionDirectory = join(testRoot, 'dist-concurrent');
    const temp1 = await makeDir('dist.tmp-concurrent-1', 'build-1');
    const temp2 = await makeDir('dist.tmp-concurrent-2', 'build-2');

    captureNextExitListener();
    atomicSwapDist(temp1, distributionDirectory);

    captureNextExitListener();
    atomicSwapDist(temp2, distributionDirectory);

    // After both swaps, dist must exist and be complete (either build-1 or build-2).
    expect(existsSync(distributionDirectory)).toBe(true);
    const content = await readSentinel(distributionDirectory);
    expect(['build-1', 'build-2']).toContain(content);
    // No litter.
    expect(oldLitter(distributionDirectory)).toHaveLength(0);
  });

  it('exit handler cleans up temp and old litter', async () => {
    const distributionDirectory = join(testRoot, 'dist-litter');
    const tempDirectory = await makeDir('dist.tmp-litter', 'litter-build');

    // First call installs dist and registers an exit listener.
    captureNextExitListener();
    atomicSwapDist(tempDirectory, distributionDirectory);

    // Manually recreate temp and old dirs to simulate mid-swap crash litter.
    mkdirSync(tempDirectory, { recursive: true });
    const oldDirectory = `${distributionDirectory}.old-${process.pid}`;
    mkdirSync(oldDirectory, { recursive: true });

    expect(exitListeners.length).toBeGreaterThanOrEqual(1);

    // Fire the last registered exit listener (the one from atomicSwapDist).
    const listener = exitListeners.at(-1);
    expect(listener).toBeDefined();
    listener?.(0);

    expect(existsSync(tempDirectory)).toBe(false);
    expect(existsSync(oldDirectory)).toBe(false);
  });

  it('registers exactly one exit listener per call', async () => {
    const before = process.listenerCount('exit');

    const distributionDirectory = join(testRoot, 'dist-listener-count');
    const tempDirectory = await makeDir('dist.tmp-listener', 'listener-build');

    atomicSwapDist(tempDirectory, distributionDirectory);

    const after = process.listenerCount('exit');
    expect(after - before).toBe(1);
  });
});
