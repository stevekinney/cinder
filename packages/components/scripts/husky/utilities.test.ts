import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  cleanupForHookSignal,
  cleanupHookProcesses,
  defaultGateLockPath,
  gateLockPathForCommonDirectory,
  getTouchedPackages,
  gitCommonDirectory,
  hasRootConfigurationChanges,
  isSourceFile,
  loadWorkspacePackages,
  LOCAL_VALIDATION_GATE_LOCK_HELD_ENV,
  parsePushRefs,
  phaseMaxConcurrency,
  REPO_ROOT,
  runHookCommand,
  runWithConcurrencyPool,
  withGateLock,
  withLocalValidationGateLock,
  type WorkspacePackage,
} from './utilities.ts';

const pkg = (
  name: string,
  dir: string,
  dependencies: string[] = [],
  flags: Partial<Pick<WorkspacePackage, 'hasLint' | 'hasTypecheck' | 'hasTest'>> = {},
): WorkspacePackage => ({
  name,
  dir,
  hasLint: flags.hasLint ?? true,
  hasTypecheck: flags.hasTypecheck ?? true,
  hasTest: flags.hasTest ?? true,
  dependencies: new Set(dependencies),
});

const fakePackages: readonly WorkspacePackage[] = [
  pkg('@cinder/diff', 'packages/diff/'),
  pkg('@cinder/markdown', 'packages/markdown/', ['@cinder/diff']),
  pkg('@lostgradient/cinder', 'packages/components/', [], { hasTest: false }),
];

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Process already exited.
    }
  }
}

async function waitForFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await Bun.file(path).exists()) return;
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function waitForProcessExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!isProcessAlive(pid)) return;
    await Bun.sleep(20);
  }
  throw new Error(`Process ${pid} is still alive`);
}

describe('runHookCommand', () => {
  it('captures output and returns a zero exit code for successful commands', async () => {
    const result = await runHookCommand(
      'bun',
      ['-e', 'console.log("hook stdout"); console.error("hook stderr");'],
      {
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hook stdout');
    expect(result.stderr).toContain('hook stderr');
  });

  it('returns non-zero failures without throwing', async () => {
    const result = await runHookCommand(
      'bun',
      ['-e', 'console.error("bad gate"); process.exit(7);'],
      {
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    expect(result.exitCode).toBe(7);
    expect(result.stderr).toContain('bad gate');
  });

  it('kills descendant processes when aborted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-hook-cleanup-'));
    const pidFile = join(directory, 'child.pid');
    const controller = new AbortController();
    let childPid: number | undefined;

    const parentScript = `
      const child = Bun.spawn(["bun", "-e", "setInterval(() => {}, 1000)"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      await Bun.write(Bun.env.CHILD_PID_FILE, String(child.pid));
      setInterval(() => {}, 1000);
    `;

    try {
      const command = runHookCommand('bun', ['-e', parentScript], {
        environment: { CHILD_PID_FILE: pidFile },
        signal: controller.signal,
        stderr: 'pipe',
        stdout: 'pipe',
      });

      await waitForFile(pidFile);
      const childPidText = await readFile(pidFile, 'utf8');
      childPid = Number(childPidText.trim());
      expect(isProcessAlive(childPid)).toBe(true);

      controller.abort();
      const result = await command;

      expect(result.exitCode).toBe(130);
      await waitForProcessExit(childPid);
    } finally {
      if (childPid !== undefined) killProcessGroup(childPid);
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('escalates to SIGKILL when descendants ignore SIGTERM', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-hook-cleanup-stubborn-'));
    const pidFile = join(directory, 'child.pid');
    const controller = new AbortController();
    let childPid: number | undefined;

    const parentScript = `
      const child = Bun.spawn([
        "bun",
        "-e",
        "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
      ], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      await Bun.write(Bun.env.CHILD_PID_FILE, String(child.pid));
      setInterval(() => {}, 1000);
    `;

    try {
      const command = runHookCommand('bun', ['-e', parentScript], {
        environment: { CHILD_PID_FILE: pidFile },
        signal: controller.signal,
        stderr: 'pipe',
        stdout: 'pipe',
      });

      await waitForFile(pidFile);
      const childPidText = await readFile(pidFile, 'utf8');
      childPid = Number(childPidText.trim());
      expect(isProcessAlive(childPid)).toBe(true);

      controller.abort();
      const result = await command;

      expect(result.exitCode).toBe(130);
      await waitForProcessExit(childPid);
    } finally {
      if (childPid !== undefined) killProcessGroup(childPid);
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('escalates to SIGKILL when the direct child ignores SIGTERM', async () => {
    const controller = new AbortController();

    const command = runHookCommand(
      'bun',
      ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"],
      {
        signal: controller.signal,
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    await Bun.sleep(20);
    controller.abort();
    const result = await command;

    expect(result.exitCode).toBe(130);
  });

  it('waits for installed hook signal cleanup before returning', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-hook-signal-cleanup-'));
    const pidFile = join(directory, 'child.pid');
    let childPid: number | undefined;

    const command = runHookCommand(
      'bun',
      [
        '-e',
        `
          await Bun.write(Bun.env.CHILD_PID_FILE, String(process.pid));
          process.on('SIGTERM', () => {});
          setInterval(() => {}, 1000);
        `,
      ],
      {
        environment: { CHILD_PID_FILE: pidFile },
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    try {
      await waitForFile(pidFile);
      const childPidText = await readFile(pidFile, 'utf8');
      childPid = Number(childPidText.trim());
      expect(isProcessAlive(childPid)).toBe(true);

      await cleanupForHookSignal('SIGTERM', { exitAfterCleanup: false });
      const result = await command;

      expect(result.exitCode).not.toBe(0);
      await waitForProcessExit(childPid);
    } finally {
      if (childPid !== undefined) killProcessGroup(childPid);
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('does not clean up unrelated processes after a managed command exits', async () => {
    const unrelated = Bun.spawn(['bun', '-e', 'setInterval(() => {}, 1000)'], {
      detached: true,
      stderr: 'ignore',
      stdin: 'ignore',
      stdout: 'ignore',
    });

    try {
      const result = await runHookCommand('bun', ['-e', 'process.exit(0);'], {
        stderr: 'pipe',
        stdout: 'pipe',
      });

      expect(result.exitCode).toBe(0);
      await cleanupHookProcesses();
      expect(isProcessAlive(unrelated.pid)).toBe(true);
    } finally {
      killProcessGroup(unrelated.pid);
      await unrelated.exited;
    }
  });

  it('does not hang when a finished command leaves a descendant holding captured output open', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-hook-stream-cleanup-'));
    const pidFile = join(directory, 'child.pid');
    let childPid: number | undefined;

    const parentScript = `
      const child = Bun.spawn(["bun", "-e", "setInterval(() => {}, 1000)"], {
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      });
      await Bun.write(Bun.env.CHILD_PID_FILE, String(child.pid));
      process.exit(0);
    `;

    try {
      const result = await runHookCommand('bun', ['-e', parentScript], {
        environment: { CHILD_PID_FILE: pidFile },
        stderr: 'pipe',
        stdout: 'pipe',
      });

      const childPidText = await readFile(pidFile, 'utf8');
      childPid = Number(childPidText.trim());

      expect(result.exitCode).toBe(0);
      await waitForProcessExit(childPid);
    } finally {
      if (childPid !== undefined) killProcessGroup(childPid);
      await rm(directory, { force: true, recursive: true });
    }
  });
});

describe('isSourceFile', () => {
  it('treats supported extensions as source', () => {
    expect(isSourceFile('packages/diff/src/index.ts')).toBe(true);
    expect(isSourceFile('packages/components/src/Button.tsx')).toBe(true);
    expect(isSourceFile('packages/components/src/Button.svelte')).toBe(true);
    expect(isSourceFile('packages/components/src/button.css')).toBe(true);
    expect(isSourceFile('packages/diff/tsconfig.json')).toBe(true);
  });

  it('excludes markdown outright', () => {
    expect(isSourceFile('README.md')).toBe(false);
    expect(isSourceFile('packages/diff/docs/intro.md')).toBe(false);
    expect(isSourceFile('packages/diff/CHANGELOG.md')).toBe(false);
  });

  it('excludes README and CHANGELOG documents lacking a source extension', () => {
    expect(isSourceFile('packages/diff/README')).toBe(false);
    expect(isSourceFile('packages/diff/CHANGELOG')).toBe(false);
    expect(isSourceFile('packages/diff/Readme.txt')).toBe(false);
  });

  it('does NOT exclude source files whose basename starts with readme or changelog', () => {
    // Regression for the round-1 bug where the basename check ran before the
    // extension check and silently dropped these files.
    expect(isSourceFile('packages/diff/src/changelog-helpers.ts')).toBe(true);
    expect(isSourceFile('packages/diff/src/readme-generator.tsx')).toBe(true);
    expect(isSourceFile('packages/diff/src/Readme.svelte')).toBe(true);
  });

  it('rejects unknown extensions', () => {
    expect(isSourceFile('packages/diff/src/index.rs')).toBe(false);
    expect(isSourceFile('packages/diff/Makefile')).toBe(false);
  });

  it('is case-insensitive on extensions and basenames', () => {
    expect(isSourceFile('packages/diff/src/Index.TS')).toBe(true);
    expect(isSourceFile('packages/diff/README.MD')).toBe(false);
  });
});

describe('getTouchedPackages', () => {
  it('returns the packages whose dir prefix matches staged source files', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/src/index.ts',
      'packages/markdown/src/parser.ts',
    ]);
    expect(touched.map((p) => p.name).toSorted()).toEqual(['@cinder/diff', '@cinder/markdown']);
  });

  it('ignores docs-only staged files', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/README.md',
      'packages/diff/CHANGELOG.md',
    ]);
    expect(touched).toEqual([]);
  });

  it('mixes source and docs files correctly', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/README.md',
      'packages/diff/src/index.ts',
      'packages/markdown/docs/notes.md',
    ]);
    expect(touched.map((p) => p.name)).toEqual(['@cinder/diff']);
  });

  it('returns empty when no staged file matches any package', () => {
    const touched = getTouchedPackages(fakePackages, ['README.md', 'package.json']);
    expect(touched).toEqual([]);
  });

  it('does not double-report a package with multiple staged files', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/src/a.ts',
      'packages/diff/src/b.ts',
      'packages/diff/src/c.ts',
    ]);
    expect(touched.map((p) => p.name)).toEqual(['@cinder/diff']);
  });
});

describe('hasRootConfigurationChanges', () => {
  it('returns true when a high-impact root file is staged', () => {
    expect(hasRootConfigurationChanges(['tsconfig.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['tsconfig.base.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['tsconfig.build.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['tsconfig.check.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['tsconfig.test.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['package.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['bun.lock'])).toBe(true);
    expect(hasRootConfigurationChanges(['.oxlintrc.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['bunfig.toml'])).toBe(true);
    expect(hasRootConfigurationChanges(['.prettierrc.json'])).toBe(true);
    expect(hasRootConfigurationChanges(['.stylelintrc.json'])).toBe(true);
  });

  it('returns false for nested files of the same name', () => {
    // packages/diff/tsconfig.json must NOT escalate to a full workspace run.
    expect(hasRootConfigurationChanges(['packages/diff/tsconfig.json'])).toBe(false);
    expect(hasRootConfigurationChanges(['packages/diff/package.json'])).toBe(false);
  });

  it('returns false when only non-root files are staged', () => {
    expect(hasRootConfigurationChanges(['packages/diff/src/index.ts', 'README.md'])).toBe(false);
  });

  it('returns false on an empty staged list', () => {
    expect(hasRootConfigurationChanges([])).toBe(false);
  });

  it('is a pure path predicate (works on push-range file lists, not just staged)', () => {
    // No staged context — exact root-relative paths still classify correctly.
    expect(hasRootConfigurationChanges(['packages/diff/src/x.ts', 'bun.lock'])).toBe(true);
    expect(hasRootConfigurationChanges(['packages/diff/src/x.ts', 'packages/diff/README.md'])).toBe(
      false,
    );
  });
});

describe('loadWorkspacePackages', () => {
  it('reads every packages/*/package.json and exposes script presence', async () => {
    const packages = await loadWorkspacePackages();
    const names = packages.map((p) => p.name).toSorted();
    expect(names).toContain('@cinder/diff');
    expect(names).toContain('@cinder/markdown');
    expect(names).toContain('@cinder/commentary');
    expect(names).toContain('@cinder/playground');
    expect(names).toContain('@cinder/testing');
    expect(names).toContain('@lostgradient/chat');
    expect(names).toContain('@lostgradient/cinder');
    for (const entry of packages) {
      expect(entry.dir.startsWith('packages/')).toBe(true);
      expect(entry.dir.endsWith('/')).toBe(true);
      expect(typeof entry.hasLint).toBe('boolean');
      expect(typeof entry.hasTypecheck).toBe('boolean');
      expect(typeof entry.hasTest).toBe('boolean');
      expect(entry.dependencies).toBeInstanceOf(Set);
    }
  });

  it('populates internal workspace dependencies (filtered to workspace names)', async () => {
    const packages = await loadWorkspacePackages();
    const byName = new Map(packages.map((entry) => [entry.name, entry] as const));

    // @cinder/playground depends on cinder.
    expect([...byName.get('@cinder/playground')!.dependencies]).toContain('@lostgradient/cinder');
    expect([...byName.get('@cinder/playground')!.dependencies]).toContain('@lostgradient/chat');
    // Chat composes Cinder primitives and utilities through the public package.
    expect([...byName.get('@lostgradient/chat')!.dependencies]).toContain('@lostgradient/cinder');
    // @cinder/markdown depends on @cinder/diff.
    expect([...byName.get('@cinder/markdown')!.dependencies]).toContain('@cinder/diff');
    // cinder dev-depends on @cinder/testing.
    expect([...byName.get('@lostgradient/cinder')!.dependencies]).toContain('@cinder/testing');
    // Every dependency name resolves to another workspace package (external
    // deps such as `chalk` are filtered out).
    const workspaceNames = new Set(packages.map((entry) => entry.name));
    for (const entry of packages) {
      for (const dep of entry.dependencies) {
        expect(workspaceNames.has(dep)).toBe(true);
      }
    }
  });
});

describe('parsePushRefs', () => {
  const ZERO = '0'.repeat(40);
  const A = 'a'.repeat(40);
  const B = 'b'.repeat(40);

  it('parses a normal update line', () => {
    const parsed = parsePushRefs(`refs/heads/x ${A} refs/heads/x ${B}`);
    expect(parsed.updates).toEqual([{ localSha: A, remoteSha: B }]);
    expect(parsed.deletionCount).toBe(0);
  });

  it('counts deletion lines (local all-zeros) without treating them as updates', () => {
    const parsed = parsePushRefs(`(delete) ${ZERO} refs/heads/x ${A}`);
    expect(parsed.updates).toEqual([]);
    expect(parsed.deletionCount).toBe(1);
  });

  it('keeps a new-branch line with an all-zeros remote sha', () => {
    const parsed = parsePushRefs(`refs/heads/x ${A} refs/heads/x ${ZERO}`);
    expect(parsed.updates).toEqual([{ localSha: A, remoteSha: ZERO }]);
  });

  it('ignores and counts blank lines', () => {
    // Leading blank, whitespace-only line, the update, and the trailing newline
    // (which yields a final empty segment) → three ignored blanks.
    const parsed = parsePushRefs(`\n  \nrefs/heads/x ${A} refs/heads/x ${B}\n`);
    expect(parsed.updates).toHaveLength(1);
    expect(parsed.ignoredBlankCount).toBe(3);
  });

  it('parses multiple ref lines', () => {
    const parsed = parsePushRefs(
      `refs/heads/x ${A} refs/heads/x ${B}\nrefs/heads/y ${B} refs/heads/y ${ZERO}`,
    );
    expect(parsed.updates).toHaveLength(2);
  });

  it('reports an all-deletions push as no updates with a deletion count', () => {
    const parsed = parsePushRefs(
      `(delete) ${ZERO} refs/heads/x ${A}\n(delete) ${ZERO} refs/heads/y ${B}`,
    );
    expect(parsed.updates).toEqual([]);
    expect(parsed.deletionCount).toBe(2);
  });

  it('treats empty stdin as no updates and no deletions', () => {
    const parsed = parsePushRefs('');
    expect(parsed.updates).toEqual([]);
    expect(parsed.deletionCount).toBe(0);
    expect(parsed.ignoredBlankCount).toBe(1);
  });

  it('throws on a non-blank malformed line (wrong field count)', () => {
    expect(() => parsePushRefs(`refs/heads/x ${A} refs/heads/x`)).toThrow();
  });

  it('throws on a non-sha-shaped local id', () => {
    expect(() => parsePushRefs('refs/heads/x not-a-sha refs/heads/x ' + B)).toThrow();
  });

  it('throws on a non-sha-shaped remote id that is not all-zeros', () => {
    expect(() => parsePushRefs(`refs/heads/x ${A} refs/heads/x not-a-sha`)).toThrow();
  });
});

/**
 * `phaseMaxConcurrency` is the side-effect-free seam extracted so this test
 * can assert the concurrency policy without importing a hook entry path
 * (which has module-scope side effects: isContinuousIntegration → process.exit,
 * stdin read). Originally added for issue #364 (pre-push and pre-commit test
 * phases raced shared-dist rebuilds); pre-push no longer runs a local test
 * phase at all — CI owns that now — so pre-commit's parallel per-package
 * typecheck is the only current caller. The policy is kept general across all
 * three `GateScript` values (not narrowed to `typecheck`) so a future local
 * gate script inherits the same bounded concurrency instead of reinventing it.
 */
describe('phaseMaxConcurrency', () => {
  function withHardwareConcurrency(value: number, run: () => void): void {
    // Pin hardwareConcurrency so the assertion is environment-independent: on
    // a real 1-vCPU host Math.max(1, Math.min(1, 4)) === 1, which would make
    // toBeGreaterThan(1) fail. The fixture value must be ≥ 2 and ≤ 4 (the cap
    // in the implementation) so the mocked result equals min(value, 4).
    const original = navigator.hardwareConcurrency;
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value,
      configurable: true,
      writable: true,
    });
    try {
      run();
    } finally {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  }

  it('returns a value greater than 1 for test (dependency closure is pre-built, so inline rebuilds hash-skip)', () => {
    withHardwareConcurrency(2, () => {
      expect(phaseMaxConcurrency('test')).toBeGreaterThan(1);
    });
  });

  it('returns a value greater than 1 for lint (read-only, safe to parallelize)', () => {
    withHardwareConcurrency(2, () => {
      expect(phaseMaxConcurrency('lint')).toBeGreaterThan(1);
    });
  });

  it('returns a value greater than 1 for typecheck (read-only, safe to parallelize)', () => {
    withHardwareConcurrency(2, () => {
      expect(phaseMaxConcurrency('typecheck')).toBeGreaterThan(1);
    });
  });

  it('returns the same concurrency for every gate script', () => {
    withHardwareConcurrency(2, () => {
      const concurrencies = (['lint', 'typecheck', 'test'] as const).map((script) =>
        phaseMaxConcurrency(script),
      );
      expect(new Set(concurrencies).size).toBe(1);
    });
  });

  it('returns a finite positive integer for every gate script', () => {
    for (const script of ['lint', 'typecheck', 'test'] as const) {
      const concurrency = phaseMaxConcurrency(script);
      expect(Number.isFinite(concurrency)).toBe(true);
      expect(concurrency).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(concurrency)).toBe(true);
    }
  });
});

/**
 * `runWithConcurrencyPool` is the *mechanism* the `phaseMaxConcurrency` policy
 * feeds. The policy tests above only prove each phase asks for a given
 * concurrency — they do NOT prove the runner honors it. Both hooks' `runJobs`
 * delegate to this pool, so a future edit that passed a hardcoded literal
 * instead of `phaseMaxConcurrency(script)` would still leave the policy tests
 * green. These tests close that gap: they instrument the worker to record the
 * maximum number of overlapping invocations and assert the pool never exceeds
 * the cap — with `maxConcurrency === 1` the overlap is strictly 1.
 */
describe('runWithConcurrencyPool', () => {
  /**
   * Run `items` through the pool with a worker that records concurrent overlap.
   * Each worker waits one microtask-batch (a resolved-promise tick) before
   * "finishing", which is enough to interleave with sibling workers if the pool
   * starts more than one at a time — so a broken cap is observable.
   */
  async function observeOverlap(
    itemCount: number,
    maxConcurrency: number,
  ): Promise<{ readonly results: number[]; readonly maxObserved: number }> {
    let active = 0;
    let maxObserved = 0;
    const items = Array.from({ length: itemCount }, (_, index) => index);
    const results = await runWithConcurrencyPool(items, maxConcurrency, async (item) => {
      active += 1;
      maxObserved = Math.max(maxObserved, active);
      // Yield several times so a too-eager pool has room to overlap workers.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      active -= 1;
      return item * 2;
    });
    return { results, maxObserved };
  }

  it('runs strictly one at a time when maxConcurrency is 1 (the #364 guarantee)', async () => {
    const { results, maxObserved } = await observeOverlap(6, 1);
    expect(maxObserved).toBe(1);
    // Results stay in input order regardless of pool scheduling.
    expect(results).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('overlaps workers up to the cap when maxConcurrency is greater than 1', async () => {
    const { results, maxObserved } = await observeOverlap(6, 3);
    // The pool must actually parallelize — otherwise the cap is meaningless and
    // the serial case above proves nothing distinctive.
    expect(maxObserved).toBe(3);
    expect(results).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('never starts more workers than there are items', async () => {
    const { maxObserved } = await observeOverlap(2, 8);
    expect(maxObserved).toBe(2);
  });

  it('returns an empty array for no items without invoking the worker', async () => {
    let invoked = false;
    const results = await runWithConcurrencyPool([], 4, async () => {
      invoked = true;
      return 1;
    });
    expect(results).toEqual([]);
    expect(invoked).toBe(false);
  });

  it('floors a non-finite concurrency to 1 instead of starting zero workers', async () => {
    // A `NaN` cap (e.g. Math.min(undefined hardwareConcurrency, 4)) must NOT
    // start zero workers and silently resolve every item to undefined — that
    // would be a false green. The floor forces strictly-serial execution.
    const { results, maxObserved } = await observeOverlap(4, Number.NaN);
    expect(maxObserved).toBe(1);
    expect(results).toEqual([0, 2, 4, 6]);
  });

  it('preserves input order even when later items resolve first', async () => {
    // Earlier indices take longer than later ones; the pool must still return
    // results indexed by input position, not completion order.
    const items = [3, 2, 1, 0];
    const results = await runWithConcurrencyPool(items, 2, async (delayTicks) => {
      for (let tick = 0; tick < delayTicks; tick += 1) await Promise.resolve();
      return delayTicks;
    });
    expect(results).toEqual([3, 2, 1, 0]);
  });
});

describe('withGateLock', () => {
  class SignalIntercepted extends Error {}

  async function withTemporaryLockPath<T>(test: (lockPath: string) => Promise<T>): Promise<T> {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-gate-lock-'));
    try {
      return await test(join(directory, 'pre-push-gate.lock'));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }

  it('derives the default lock path from the shared Git common directory', () => {
    const commonDirectory = gitCommonDirectory();
    const expectedPath = gateLockPathForCommonDirectory(commonDirectory);

    expect(commonDirectory).toBe(gitCommonDirectory(REPO_ROOT));
    expect(defaultGateLockPath()).toBe(expectedPath);
    expect(defaultGateLockPath()).not.toContain(REPO_ROOT);
  });

  it('creates a lock while the protected function runs and removes it after success', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      let lockContents = '';

      const result = await withGateLock(
        async () => {
          lockContents = await readFile(lockPath, 'utf8');
          return 'passed';
        },
        { lockPath },
      );

      expect(result).toBe('passed');
      expect(JSON.parse(lockContents)).toMatchObject({
        pid: process.pid,
        repositoryRoot: expect.any(String),
      });
      expect(await Bun.file(lockPath).exists()).toBe(false);
    });
  });

  it('removes the lock when the protected function throws', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await expect(
        withGateLock(
          async () => {
            throw new Error('gate failed');
          },
          { lockPath },
        ),
      ).rejects.toThrow('gate failed');

      expect(await Bun.file(lockPath).exists()).toBe(false);
    });
  });

  it('does not retry when the protected function throws an EEXIST-coded error', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      const error = new Error('gate callback failed') as NodeJS.ErrnoException;
      error.code = 'EEXIST';
      let attempts = 0;

      await expect(
        withGateLock(
          async () => {
            attempts += 1;
            throw error;
          },
          { lockPath, retryMilliseconds: 1, waitMilliseconds: 5 },
        ),
      ).rejects.toThrow('gate callback failed');

      expect(attempts).toBe(1);
      expect(await Bun.file(lockPath).exists()).toBe(false);
    });
  });

  it('does not remove a lock that was replaced before cleanup', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await withGateLock(
        async () => {
          await writeFile(
            lockPath,
            JSON.stringify({
              createdAt: new Date().toISOString(),
              pid: process.pid,
              repositoryRoot: 'replacement',
              token: 'replacement-token',
            }),
          );
        },
        { lockPath },
      );

      expect(JSON.parse(await readFile(lockPath, 'utf8'))).toMatchObject({
        repositoryRoot: 'replacement',
        token: 'replacement-token',
      });
    });
  });

  it('waits for the active gate to finish before entering a second gate', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      let releaseFirstGate!: () => void;
      const firstGateReleased = new Promise<void>((resolve) => {
        releaseFirstGate = resolve;
      });
      let markFirstGateStarted!: () => void;
      const firstGateStarted = new Promise<void>((resolve) => {
        markFirstGateStarted = resolve;
      });
      const entries: string[] = [];

      const firstGate = withGateLock(
        async () => {
          entries.push('first');
          markFirstGateStarted();
          await firstGateReleased;
        },
        { lockPath, retryMilliseconds: 1, waitMilliseconds: 100 },
      );

      await firstGateStarted;

      const secondGate = withGateLock(
        async () => {
          entries.push('second');
        },
        { lockPath, retryMilliseconds: 1, waitMilliseconds: 100 },
      );

      try {
        await Bun.sleep(5);
        expect(entries).toEqual(['first']);

        releaseFirstGate();
        await Promise.all([firstGate, secondGate]);

        expect(entries).toEqual(['first', 'second']);
        expect(await Bun.file(lockPath).exists()).toBe(false);
      } finally {
        releaseFirstGate();
        await firstGate;
      }
    });
  });

  it('fails after the bounded wait when a live gate keeps the lock', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(
        lockPath,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          pid: 123,
          repositoryRoot: 'other-checkout',
          token: 'still-running',
        }),
      );

      await expect(
        withGateLock(async () => 'should not run', {
          isProcessAlive: () => true,
          lockPath,
          retryMilliseconds: 1,
          waitMilliseconds: 5,
        }),
      ).rejects.toThrow('Another local validation gate is already running');
    });
  });

  it('does not immediately reclaim a newly malformed lock', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(lockPath, '{');

      await expect(
        withGateLock(async () => 'should not run', {
          lockPath,
          malformedLockGraceMilliseconds: 1_000,
          retryMilliseconds: 1,
          waitMilliseconds: 5,
        }),
      ).rejects.toThrow('malformed lock');

      expect(await readFile(lockPath, 'utf8')).toBe('{');
    });
  });

  it('retries when the lock disappears before malformed-lock age can be checked', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(lockPath, '{');

      const result = await withGateLock(async () => 'retried after disappeared lock', {
        beforeMalformedLockStat: async () => {
          await rm(lockPath, { force: true });
        },
        lockPath,
        retryMilliseconds: 1,
        waitMilliseconds: 100,
      });

      expect(result).toBe('retried after disappeared lock');
      expect(await Bun.file(lockPath).exists()).toBe(false);
    });
  });

  it('reclaims an old malformed lock', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(lockPath, '{');

      const result = await withGateLock(async () => 'reclaimed malformed lock', {
        lockPath,
        malformedLockGraceMilliseconds: -1,
      });

      expect(result).toBe('reclaimed malformed lock');
      expect(await Bun.file(lockPath).exists()).toBe(false);
    });
  });

  it('reclaims a stale lock whose process is no longer alive', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(
        lockPath,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          pid: 999_999,
          repositoryRoot: 'old-checkout',
          token: 'stale',
        }),
      );

      const result = await withGateLock(async () => 'reclaimed', {
        isProcessAlive: () => false,
        lockPath,
      });

      expect(result).toBe('reclaimed');
      expect(await Bun.file(lockPath).exists()).toBe(false);
    });
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    it(`keeps the lock until the protected function finishes after ${signal}`, async () => {
      await withTemporaryLockPath(async (lockPath) => {
        let receivedSignal: NodeJS.Signals | undefined;
        let continuedAfterSignal = false;
        await expect(
          withGateLock(
            async () => {
              expect(await Bun.file(lockPath).exists()).toBe(true);
              process.emit(signal);
              expect(await Bun.file(lockPath).exists()).toBe(true);
              continuedAfterSignal = true;
              throw new SignalIntercepted(signal);
            },
            {
              lockPath,
              resendSignal: (signalToResend) => {
                receivedSignal = signalToResend;
                expect(existsSync(lockPath)).toBe(false);
              },
            },
          ),
        ).rejects.toThrow(SignalIntercepted);

        expect(continuedAfterSignal).toBe(true);
        expect(receivedSignal).toBe(signal);
        expect(await Bun.file(lockPath).exists()).toBe(false);
      });
    });
  }
});

describe('withLocalValidationGateLock', () => {
  async function withTemporaryLockPath<T>(test: (lockPath: string) => Promise<T>): Promise<T> {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-local-validation-lock-'));
    try {
      return await test(join(directory, 'local-validation.lock'));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }

  it('marks the lock as held while the protected function runs and restores the environment', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      const previousValue = Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
      delete Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
      try {
        let markerInsideRun: string | undefined;

        await withLocalValidationGateLock(
          async () => {
            markerInsideRun = Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
          },
          { lockPath },
        );

        expect(markerInsideRun).toBe('1');
        expect(Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV]).toBeUndefined();
      } finally {
        if (previousValue === undefined) {
          delete Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
        } else {
          Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV] = previousValue;
        }
      }
    });
  });

  it('does not re-acquire the lock when a parent validation gate already holds it', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(
        lockPath,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          pid: process.pid,
          repositoryRoot: 'parent-gate',
          token: 'already-held',
        }),
      );

      const previousValue = Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
      Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV] = '1';
      try {
        const result = await withLocalValidationGateLock(async () => 'skipped nested acquire', {
          lockPath,
          isProcessAlive: () => true,
          retryMilliseconds: 1,
          waitMilliseconds: 1,
        });

        expect(result).toBe('skipped nested acquire');
        expect(await Bun.file(lockPath).exists()).toBe(true);
      } finally {
        if (previousValue === undefined) {
          delete Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
        } else {
          Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV] = previousValue;
        }
        await rm(lockPath, { force: true });
      }
    });
  });
});
