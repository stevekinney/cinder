// Real-filesystem behavior of atomicSwapDist: the paths that can be exercised
// deterministically with serial calls (first build, rebuild, unexpected-error
// re-throw, exit-handler cleanup, listener registration). The concurrent-winner
// race branches (step-2 ENOENT, step-3 destination-exists) need a mid-call
// filesystem mutation and live in atomic-swap-dist.mock.test.ts instead.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { atomicSwapDist, stagingDirectoryName } from './atomic-swap-dist.ts';

/** Per-test isolated filesystem root. */
let testRoot: string;
/** 'exit' listeners registered during a test, removed in teardown. */
const exitListeners: Array<NodeJS.ExitListener> = [];
/** The real process.on, captured once so teardown can always restore it. */
const originalProcessOn = process.on.bind(process);

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), 'atomic-swap-test-'));
  // Patch process.on for the whole test so EVERY atomicSwapDist call's exit
  // listener is captured (and removed in teardown) — including calls that throw
  // before we would otherwise restore it. Restoration is unconditional in
  // afterEach, so a patched process.on never leaks into the next test.
  process.on = ((event: string, listener: NodeJS.ExitListener) => {
    if (event === 'exit') exitListeners.push(listener);
    return originalProcessOn(event as Parameters<typeof process.on>[0], listener as never);
  }) as typeof process.on;
});

afterEach(() => {
  process.on = originalProcessOn as typeof process.on;
  for (const listener of exitListeners) process.off('exit', listener);
  exitListeners.length = 0;
  rmSync(testRoot, { recursive: true, force: true });
});

async function makeDir(name: string, sentinelContent = 'sentinel-ok'): Promise<string> {
  const directory = join(testRoot, name);
  mkdirSync(directory, { recursive: true });
  await writeFile(join(directory, 'index.js'), sentinelContent);
  return directory;
}

async function readSentinel(directory: string): Promise<string> {
  return Bun.file(join(directory, 'index.js')).text();
}

/** Any `dist.old-*` siblings of `distributionDirectory` (leftover litter). */
function oldLitter(distributionDirectory: string): string[] {
  const parentDir = join(distributionDirectory, '..');
  const base = distributionDirectory.split('/').at(-1) ?? '';
  const glob = new Bun.Glob(`${base}.old-*`);
  return [...glob.scanSync({ cwd: parentDir, onlyFiles: false })];
}

describe('atomicSwapDist (real filesystem)', () => {
  it('first build: installs temp as dist when dist does not exist', async () => {
    const tempDirectory = await makeDir(stagingDirectoryName(), 'first-build');
    const distributionDirectory = join(testRoot, 'dist');

    expect(existsSync(distributionDirectory)).toBe(false);
    atomicSwapDist(tempDirectory, distributionDirectory);

    expect(existsSync(distributionDirectory)).toBe(true);
    expect(existsSync(tempDirectory)).toBe(false);
    expect(await readSentinel(distributionDirectory)).toBe('first-build');
    expect(oldLitter(distributionDirectory)).toHaveLength(0);
  });

  it('rebuild: replaces existing dist with temp, leaving no litter', async () => {
    const distributionDirectory = join(testRoot, 'dist');
    const priorDist = await makeDir('dist-prior', 'old-build');
    renameSync(priorDist, distributionDirectory);

    const tempDirectory = await makeDir(stagingDirectoryName(), 'new-build');
    atomicSwapDist(tempDirectory, distributionDirectory);

    expect(existsSync(distributionDirectory)).toBe(true);
    expect(existsSync(tempDirectory)).toBe(false);
    expect(await readSentinel(distributionDirectory)).toBe('new-build');
    expect(oldLitter(distributionDirectory)).toHaveLength(0);
  });

  it('re-throws an unexpected error instead of reporting false success', async () => {
    // dist is a FILE, not a directory. rename(tempDir, file) fails with ENOTDIR
    // (POSIX) — NOT one of the benign "dist already exists" race codes — so the
    // helper must surface it rather than swallow it.
    const tempDirectory = await makeDir(stagingDirectoryName(), 'build');
    const distributionDirectory = join(testRoot, 'dist');
    writeFileSync(distributionDirectory, 'i am a file, not a directory');

    expect(() => atomicSwapDist(tempDirectory, distributionDirectory)).toThrow();
    // The staging tree is left intact for the caller to inspect; nothing claims
    // the build succeeded.
    expect(existsSync(tempDirectory)).toBe(true);
  });

  it('exit handler cleans up temp and old litter (backstop for mid-swap exit)', async () => {
    const distributionDirectory = join(testRoot, 'dist-litter');
    const tempDirectory = await makeDir(stagingDirectoryName(), 'litter-build');

    atomicSwapDist(tempDirectory, distributionDirectory);

    // Re-create temp + an old-style sibling to simulate litter from a process
    // that exited mid-swap, then fire the registered exit listener.
    mkdirSync(tempDirectory, { recursive: true });
    const oldDirectory = `${distributionDirectory}.old-simulated`;
    mkdirSync(oldDirectory, { recursive: true });

    const listener = exitListeners.at(-1);
    expect(listener).toBeDefined();
    listener?.(0);

    expect(existsSync(tempDirectory)).toBe(false);
    // The handler removes the oldDirectory IT closed over; our simulated one has
    // a different suffix, so assert the handler ran (temp gone) without claiming
    // it cleans arbitrary siblings.
    rmSync(oldDirectory, { recursive: true, force: true });
  });

  it('registers exactly one exit listener per call', async () => {
    const before = process.listenerCount('exit');
    const distributionDirectory = join(testRoot, 'dist-listener-count');
    const tempDirectory = await makeDir(stagingDirectoryName(), 'listener-build');

    atomicSwapDist(tempDirectory, distributionDirectory);

    expect(process.listenerCount('exit') - before).toBe(1);
  });
});

describe('stagingDirectoryName', () => {
  it('is a dist.tmp-* name (matches the gitignore + helper cleanup glob)', () => {
    expect(stagingDirectoryName()).toMatch(/^dist\.tmp-/);
  });

  it('is unique per call so concurrent builds never collide', () => {
    const names = new Set(Array.from({ length: 50 }, () => stagingDirectoryName()));
    expect(names.size).toBe(50);
  });
});
