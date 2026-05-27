import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  cleanupForHookSignal,
  cleanupHookProcesses,
  formatFailureSummary,
  getTouchedPackages,
  inferFailureScope,
  isSourceFile,
  loadWorkspacePackages,
  rootConfigStaged,
  runHookCommand,
  summarizeFailures,
  withGateLock,
  type WorkspacePackage,
} from './utilities.ts';

const fakePackages: readonly WorkspacePackage[] = [
  { name: '@cinder/diff', dir: 'packages/diff/', hasTypecheck: true, hasTest: true },
  { name: '@cinder/markdown', dir: 'packages/markdown/', hasTypecheck: true, hasTest: true },
  { name: 'cinder', dir: 'packages/components/', hasTypecheck: true, hasTest: false },
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

describe('rootConfigStaged', () => {
  it('returns true when a high-impact root file is staged', () => {
    expect(rootConfigStaged(['tsconfig.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.base.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.build.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.check.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.test.json'])).toBe(true);
    expect(rootConfigStaged(['package.json'])).toBe(true);
    expect(rootConfigStaged(['bun.lock'])).toBe(true);
    expect(rootConfigStaged(['.oxlintrc.json'])).toBe(true);
    expect(rootConfigStaged(['bunfig.toml'])).toBe(true);
    expect(rootConfigStaged(['.prettierrc.json'])).toBe(true);
    expect(rootConfigStaged(['.stylelintrc.json'])).toBe(true);
  });

  it('returns false for nested files of the same name', () => {
    // packages/diff/tsconfig.json must NOT escalate to a full workspace run.
    expect(rootConfigStaged(['packages/diff/tsconfig.json'])).toBe(false);
    expect(rootConfigStaged(['packages/diff/package.json'])).toBe(false);
  });

  it('returns false when only non-root files are staged', () => {
    expect(rootConfigStaged(['packages/diff/src/index.ts', 'README.md'])).toBe(false);
  });

  it('returns false on an empty staged list', () => {
    expect(rootConfigStaged([])).toBe(false);
  });
});

describe('loadWorkspacePackages', () => {
  it('reads every packages/*/package.json and exposes script presence', async () => {
    const packages = await loadWorkspacePackages();
    const names = packages.map((p) => p.name).toSorted();
    expect(names).toContain('@cinder/diff');
    expect(names).toContain('@cinder/markdown');
    expect(names).toContain('@cinder/editor');
    expect(names).toContain('@cinder/commentary');
    expect(names).toContain('@cinder/playground');
    expect(names).toContain('@cinder/testing');
    expect(names).toContain('cinder');
    for (const pkg of packages) {
      expect(pkg.dir.startsWith('packages/')).toBe(true);
      expect(pkg.dir.endsWith('/')).toBe(true);
      expect(typeof pkg.hasTypecheck).toBe('boolean');
      expect(typeof pkg.hasTest).toBe('boolean');
    }
  });
});

describe('summarizeFailures', () => {
  it('extracts Bun test failure markers', () => {
    const summary = summarizeFailures(`
      102 pass
      (fail) discoverSidebarComponents > keeps the sidebar at or below the 85-entry product gate [12.00ms]
      Expected: <= 85
    `);

    expect(summary).toEqual([
      '(fail) discoverSidebarComponents > keeps the sidebar at or below the 85-entry product gate [12.00ms]',
    ]);
  });

  it('removes Bun workspace prefixes from failure details', () => {
    const summary = summarizeFailures(`
      cinder test: (fail) Button > renders disabled state [4.00ms]
    `);

    expect(summary).toEqual(['(fail) Button > renders disabled state [4.00ms]']);
  });

  it('extracts TypeScript diagnostics', () => {
    const summary = summarizeFailures(`
      packages/components/src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
      Found 1 error.
    `);

    expect(summary).toEqual([
      "packages/components/src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
    ]);
  });

  it('extracts linter diagnostics', () => {
    const summary = summarizeFailures(`
      packages/components/src/button.css
        10:3  ✖  Unexpected unknown property "colour"  property-no-unknown
      1 problem (1 error, 0 warnings)
    `);

    expect(summary).toEqual([
      'packages/components/src/button.css:10:3  ✖  Unexpected unknown property "colour"  property-no-unknown',
    ]);
  });

  it('extracts Oxlint formatter diagnostics', () => {
    const summary = summarizeFailures(`
      x Unexpected token
      ,-[tmp/review-fixtures/unused.ts:1:11]
      1 | const x = ;
      :           ^
      \`----
      Found 0 warnings and 1 error.
    `);

    expect(summary).toEqual(['x Unexpected token', 'tmp/review-fixtures/unused.ts:1:11']);
  });

  it('falls back to the last non-empty output lines', () => {
    const summary = summarizeFailures(`
      starting gate
      something went wrong
      no known marker
    `);

    expect(summary).toEqual(['starting gate', 'something went wrong', 'no known marker']);
  });

  it('limits long summaries', () => {
    const summary = summarizeFailures(
      `
        (fail) first
        (fail) second
        (fail) third
        (fail) fourth
      `,
      2,
    );

    expect(summary).toEqual(['(fail) first', '(fail) second', '...and 2 more failure lines']);
  });
});

describe('inferFailureScope', () => {
  it('names the package when Bun prefixes failure output', () => {
    const scope = inferFailureScope(`
      cinder test: (fail) Button > renders disabled state [4.00ms]
    `);

    expect(scope).toBe('cinder');
  });

  it('falls back to workspace when no package prefix is present', () => {
    expect(inferFailureScope('(fail) root suite')).toBe('workspace');
  });

  it('reports multiple packages when several package-prefixed failures appear', () => {
    const scope = inferFailureScope(`
      cinder test: (fail) Button > renders disabled state [4.00ms]
      @cinder/playground test: (fail) discoverSidebarComponents > caps entries [12.00ms]
    `);

    expect(scope).toBe('multiple packages');
  });
});

describe('formatFailureSummary', () => {
  it('names the failing gate, scope, and concise details', () => {
    const summary = formatFailureSummary([
      {
        script: 'test',
        scope: 'workspace',
        lines: [
          '(fail) discoverSidebarComponents > keeps the sidebar at or below the 85-entry product gate',
        ],
      },
    ]);

    expect(summary).toEqual([
      'PRE-PUSH FAILED',
      '  test -> workspace: 1 failure',
      '    (fail) discoverSidebarComponents > keeps the sidebar at or below the 85-entry product gate',
    ]);
  });

  it('counts omitted failure lines without counting the truncation line as a failure', () => {
    const summary = formatFailureSummary([
      {
        script: 'test',
        scope: 'workspace',
        lines: ['(fail) first', '(fail) second', '...and 2 more failure lines'],
      },
    ]);

    expect(summary).toEqual([
      'PRE-PUSH FAILED',
      '  test -> workspace: 4 failures',
      '    (fail) first',
      '    (fail) second',
      '    ...and 2 more failure lines',
    ]);
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
      ).rejects.toThrow('Another pre-push gate is already running');
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
