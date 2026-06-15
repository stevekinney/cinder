// Deterministic branch coverage for atomicSwapDist's concurrent-winner state
// machine. The step-2 ENOENT and step-3 destination-exists races cannot be
// forced with serial real-filesystem calls — they need a concurrent actor
// mutating the tree mid-call — so here we drive the helper with a FAKE
// filesystem injected through its `fileSystem` parameter and assert it recovers
// (or re-throws) exactly as designed.
//
// We inject a fake rather than `mock.module('node:fs', ...)` on purpose:
// `mock.module` is process-global in Bun and would leak the no-op renameSync
// into the sibling real-filesystem suite (atomic-swap-dist.test.ts) when both
// files run in one `bun test` process. Dependency injection keeps this file's
// mocking fully local — no global state, no module-evaluation-order coupling.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { atomicSwapDist } from './atomic-swap-dist.ts';

/** A synthetic errno error, shaped like Node's NodeJS.ErrnoException. */
function errnoError(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`synthetic ${code}`);
  error.code = code;
  return error;
}

/**
 * Build a fake filesystem to inject. `throwOnCall` maps a 1-based `renameSync`
 * call index to the errno code that call should throw; any call not listed is a
 * no-op success. `rmTargets` records every `rmSync` target so we can assert
 * cleanup without touching disk. `renameCallCount()` reports how far the state
 * machine progressed.
 */
function makeFakeFileSystem(throwOnCall: Map<number, string>) {
  let renameCallCount = 0;
  const rmTargets: string[] = [];
  return {
    renameCallCount: () => renameCallCount,
    rmTargets,
    fileSystem: {
      renameSync: ((_from: string, _to: string) => {
        renameCallCount += 1;
        const code = throwOnCall.get(renameCallCount);
        if (code) throw errnoError(code);
      }) as typeof import('node:fs').renameSync,
      rmSync: ((target: string) => {
        rmTargets.push(target);
      }) as typeof import('node:fs').rmSync,
    },
  };
}

// The helper registers a `process.on('exit')` backstop on every call. Capture
// those listeners so we can remove them in teardown and assert one-per-call,
// instead of leaking real exit listeners across the suite.
const exitListeners: Array<NodeJS.ExitListener> = [];
const originalProcessOn = process.on.bind(process);

beforeEach(() => {
  process.on = ((event: string, listener: NodeJS.ExitListener) => {
    if (event === 'exit') exitListeners.push(listener);
    return originalProcessOn(event as Parameters<typeof process.on>[0], listener as never);
  }) as typeof process.on;
});

afterEach(() => {
  process.on = originalProcessOn;
  for (const listener of exitListeners) process.off('exit', listener);
  exitListeners.length = 0;
});

const TEMP = '/fake/dist.tmp-x';
const DIST = '/fake/dist';

describe('atomicSwapDist (injected fake filesystem — race branches)', () => {
  it('step 1 success: first build installs temp as dist, no further work', () => {
    // rename #1 (temp→dist) succeeds; no other rename should run.
    const fake = makeFakeFileSystem(new Map());
    atomicSwapDist(TEMP, DIST, fake.fileSystem);
    expect(fake.renameCallCount()).toBe(1);
    // Success path removes nothing eagerly (the moved temp IS the new dist).
    expect(fake.rmTargets).toHaveLength(0);
  });

  it('rebuild success: dist exists → vacate → install → remove old', () => {
    // #1 temp→dist fails (dist exists), #2 dist→old ok, #3 temp→dist ok.
    const fake = makeFakeFileSystem(new Map([[1, 'ENOTEMPTY']]));
    atomicSwapDist(TEMP, DIST, fake.fileSystem);
    expect(fake.renameCallCount()).toBe(3);
    // Step 4 removes exactly the vacated `old` tree.
    expect(fake.rmTargets).toHaveLength(1);
    expect(fake.rmTargets[0]).toContain(`${DIST}.old-`);
  });

  it('step 2 ENOENT (concurrent winner installed dist): returns, cleans temp', () => {
    // #1 fails (dist exists), #2 dist→old fails ENOENT (a winner moved dist away).
    const fake = makeFakeFileSystem(
      new Map([
        [1, 'EEXIST'],
        [2, 'ENOENT'],
      ]),
    );
    expect(() => atomicSwapDist(TEMP, DIST, fake.fileSystem)).not.toThrow();
    expect(fake.renameCallCount()).toBe(2); // never reaches step 3
    // Our now-redundant staging tree is cleaned synchronously.
    expect(fake.rmTargets).toContain(TEMP);
  });

  it('step 3 destination-exists (winner raced in after we vacated): cleans old + temp', () => {
    // #1 fails (dist exists), #2 vacate ok, #3 temp→dist fails (winner reinstalled dist).
    const fake = makeFakeFileSystem(
      new Map([
        [1, 'ENOTEMPTY'],
        [3, 'ENOTEMPTY'],
      ]),
    );
    expect(() => atomicSwapDist(TEMP, DIST, fake.fileSystem)).not.toThrow();
    expect(fake.renameCallCount()).toBe(3);
    // Both the vacated old tree and our redundant staging tree are removed.
    expect(fake.rmTargets.some((path) => path.includes(`${DIST}.old-`))).toBe(true);
    expect(fake.rmTargets).toContain(TEMP);
  });

  it('step 1 unexpected error (EACCES) re-throws — never masquerades as success', () => {
    const fake = makeFakeFileSystem(new Map([[1, 'EACCES']]));
    expect(() => atomicSwapDist(TEMP, DIST, fake.fileSystem)).toThrow(/EACCES/);
    expect(fake.renameCallCount()).toBe(1);
  });

  it('step 1 ENOTDIR (dist is a file, not the expected dir) re-throws', () => {
    const fake = makeFakeFileSystem(new Map([[1, 'ENOTDIR']]));
    expect(() => atomicSwapDist(TEMP, DIST, fake.fileSystem)).toThrow(/ENOTDIR/);
  });

  it('step 2 unexpected error (EXDEV cross-device) re-throws', () => {
    const fake = makeFakeFileSystem(
      new Map([
        [1, 'ENOTEMPTY'], // reach step 2
        [2, 'EXDEV'],
      ]),
    );
    expect(() => atomicSwapDist(TEMP, DIST, fake.fileSystem)).toThrow(/EXDEV/);
    expect(fake.renameCallCount()).toBe(2);
  });

  it('step 3 unexpected error (EACCES): rolls back old→dist, then re-throws', () => {
    // #1 fails (dist exists), #2 vacate dist→old ok, #3 install temp→dist fails
    // for a non-race reason. The helper must restore the last good build by
    // renaming old→dist (call #4) before re-throwing the ORIGINAL EACCES — never
    // leaving the package with no dist at all (the #364-followup rollback bug).
    const renameArgs: Array<[string, string]> = [];
    let renameCallCount = 0;
    const rmTargets: string[] = [];
    const fileSystem = {
      renameSync: ((from: string, to: string) => {
        renameCallCount += 1;
        renameArgs.push([from, to]);
        if (renameCallCount === 1) throw errnoError('ENOTEMPTY');
        if (renameCallCount === 3) throw errnoError('EACCES');
        // call #2 (vacate) and call #4 (rollback) succeed.
      }) as typeof import('node:fs').renameSync,
      rmSync: ((target: string) => {
        rmTargets.push(target);
      }) as typeof import('node:fs').rmSync,
    };

    expect(() => atomicSwapDist(TEMP, DIST, fileSystem)).toThrow(/EACCES/);
    // 4 renames: install-attempt, vacate, failed-install, rollback.
    expect(renameCallCount).toBe(4);
    // The 4th rename is the rollback: old → dist (the inverse of the step-2 vacate).
    const [rollbackFrom, rollbackTo] = renameArgs[3]!;
    expect(rollbackFrom).toContain(`${DIST}.old-`);
    expect(rollbackTo).toBe(DIST);
    // The rollback path must NOT delete the old tree — it is the restored build.
    expect(rmTargets).toHaveLength(0);
  });

  it('step 3 unexpected error with a FAILING rollback: still re-throws the original error, preserves old', () => {
    // Same as above, but a concurrent build installs a complete dist in the gap,
    // so the rollback rename (#4) fails with EEXIST. The helper must swallow the
    // rollback failure, preserve `old` (it may be the last good build), and
    // re-throw the ORIGINAL ENOSPC — the rollback failure must not mask it.
    const rmTargets: string[] = [];
    let renameCallCount = 0;
    const fileSystem = {
      renameSync: ((_from: string, _to: string) => {
        renameCallCount += 1;
        if (renameCallCount === 1) throw errnoError('ENOTEMPTY');
        if (renameCallCount === 3) throw errnoError('ENOSPC'); // install fails
        if (renameCallCount === 4) throw errnoError('EEXIST'); // rollback fails (winner installed dist)
        // call #2 (vacate) succeeds.
      }) as typeof import('node:fs').renameSync,
      rmSync: ((target: string) => {
        rmTargets.push(target);
      }) as typeof import('node:fs').rmSync,
    };

    expect(() => atomicSwapDist(TEMP, DIST, fileSystem)).toThrow(/ENOSPC/);
    expect(renameCallCount).toBe(4);
    // Old is NOT deleted on the rollback-failure path — preserved for recovery.
    expect(rmTargets).toHaveLength(0);
  });

  it('exit handler cleans the staging tree but NEVER the vacated old tree', () => {
    // Reach the step-3 rollback path (old survives on disk), then fire the
    // registered exit listener and assert it removes ONLY temp — deleting old
    // here is exactly the bug that destroyed the last good build.
    const rmTargets: string[] = [];
    let renameCallCount = 0;
    const fileSystem = {
      renameSync: ((_from: string, _to: string) => {
        renameCallCount += 1;
        if (renameCallCount === 1) throw errnoError('ENOTEMPTY');
        if (renameCallCount === 3) throw errnoError('EACCES');
      }) as typeof import('node:fs').renameSync,
      rmSync: ((target: string) => {
        rmTargets.push(target);
      }) as typeof import('node:fs').rmSync,
    };

    const before = exitListeners.length;
    expect(() => atomicSwapDist(TEMP, DIST, fileSystem)).toThrow(/EACCES/);
    const registered = exitListeners[before];
    expect(registered).toBeDefined();

    // Nothing removed during the swap itself (rollback path removes nothing).
    expect(rmTargets).toHaveLength(0);
    // Fire the exit backstop (code 0 = normal exit): it must remove temp only,
    // never the old tree.
    registered!(0);
    expect(rmTargets).toContain(TEMP);
    expect(rmTargets.some((path) => path.includes(`${DIST}.old-`))).toBe(false);
  });

  it('registers exactly one exit listener per call', () => {
    const before = process.listenerCount('exit');
    atomicSwapDist(TEMP, DIST, makeFakeFileSystem(new Map()).fileSystem);
    expect(process.listenerCount('exit') - before).toBe(1);
  });
});
