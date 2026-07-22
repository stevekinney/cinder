import { describe, expect, it, spyOn } from 'bun:test';
import { existsSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildableForwardClosure,
  changedCssLikeFiles,
  changedFilesForRange,
  cleanupForHookSignal,
  cleanupHookProcesses,
  defaultGateLockPath,
  expandToDependents,
  gateLockPathForWorktreeRoot,
  isIgnorableDoc,
  isNewBranch,
  isSourceFile,
  isUnderWorkspace,
  LOCAL_VALIDATION_GATE_LOCK_HELD_ENV,
  nodeModulesTopology,
  parsePushRefs,
  prePushPackageScript,
  REPO_ROOT,
  runHookCommand,
  withGateLock,
  withLocalValidationGateLock,
  type GitRunner,
  type PushRefUpdate,
  type WorkspacePackage,
} from './utilities.ts';

const pkg = (name: string, dir: string, dependencies: string[] = []): WorkspacePackage => ({
  name,
  dir,
  dependencies: new Set(dependencies),
});

// A fixture mirroring the real internal dependency graph for closure tests.
const graphPackages: readonly WorkspacePackage[] = [
  pkg('@lostgradient/cinder', 'packages/components/', [
    '@lostgradient/editor',
    '@cinder/diff',
    '@cinder/markdown',
    '@cinder/testing',
  ]),
  pkg('@cinder/markdown', 'packages/markdown/', ['@cinder/diff']),
  pkg('@lostgradient/editor', 'packages/editor/', ['@cinder/markdown']),
  pkg('@lostgradient/chat', 'packages/chat/', ['@lostgradient/cinder']),
  pkg('@cinder/playground', 'packages/playground/', ['@lostgradient/chat', '@lostgradient/cinder']),
  pkg('@cinder/diff', 'packages/diff/'),
  pkg('@cinder/testing', 'packages/testing/'),
];

const sorted = (names: Iterable<string>): string[] => [...names].toSorted();
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
    expect(isSourceFile('packages/markdown/src/index.ts')).toBe(true);
    expect(isSourceFile('packages/components/src/Button.tsx')).toBe(true);
    expect(isSourceFile('packages/components/src/Button.svelte')).toBe(true);
    expect(isSourceFile('packages/components/src/button.css')).toBe(true);
    expect(isSourceFile('packages/markdown/tsconfig.json')).toBe(true);
  });

  it('excludes markdown outright', () => {
    expect(isSourceFile('README.md')).toBe(false);
    expect(isSourceFile('packages/markdown/docs/intro.md')).toBe(false);
    expect(isSourceFile('packages/markdown/CHANGELOG.md')).toBe(false);
  });

  it('excludes README and CHANGELOG documents lacking a source extension', () => {
    expect(isSourceFile('packages/markdown/README')).toBe(false);
    expect(isSourceFile('packages/markdown/CHANGELOG')).toBe(false);
    expect(isSourceFile('packages/markdown/Readme.txt')).toBe(false);
  });

  it('does NOT exclude source files whose basename starts with readme or changelog', () => {
    // Regression for the round-1 bug where the basename check ran before the
    // extension check and silently dropped these files.
    expect(isSourceFile('packages/markdown/src/changelog-helpers.ts')).toBe(true);
    expect(isSourceFile('packages/markdown/src/readme-generator.tsx')).toBe(true);
    expect(isSourceFile('packages/markdown/src/Readme.svelte')).toBe(true);
  });

  it('rejects unknown extensions', () => {
    expect(isSourceFile('packages/markdown/src/index.rs')).toBe(false);
    expect(isSourceFile('packages/markdown/Makefile')).toBe(false);
  });

  it('is case-insensitive on extensions and basenames', () => {
    expect(isSourceFile('packages/markdown/src/Index.TS')).toBe(true);
    expect(isSourceFile('packages/markdown/README.MD')).toBe(false);
  });
});

describe('expandToDependents', () => {
  // NOTE: the real graph has `@lostgradient/cinder` dev-depending on every sub-package (its
  // own tests import them), `@lostgradient/chat` depending on Cinder, and
  // `@cinder/playground` depending on both public packages. So any sub-package
  // change pulls in Cinder + Chat + playground as
  // dependents. Only `@lostgradient/editor` (a true leaf in the consumer
  // direction) and `@cinder/playground` stay small. These expectations are the
  // sound closures, computed from the graph — not the smaller sets an earlier
  // draft assumed.
  const expand = (name: string) => sorted(expandToDependents(graphPackages, [name]));

  it('keeps @cinder/playground a leaf (nothing depends on it)', () => {
    expect(expand('@cinder/playground')).toEqual(['@cinder/playground']);
  });

  it('expands @lostgradient/editor through both public packages to playground', () => {
    expect(expand('@lostgradient/editor')).toEqual([
      '@lostgradient/editor',
      '@cinder/playground',
      '@lostgradient/chat',
      '@lostgradient/cinder',
    ]);
  });

  it('expands @cinder/markdown to markdown + editor + cinder + playground', () => {
    expect(expand('@cinder/markdown')).toEqual([
      '@lostgradient/editor',
      '@cinder/markdown',
      '@cinder/playground',
      '@lostgradient/chat',
      '@lostgradient/cinder',
    ]);
  });

  it('expands @cinder/diff to the full dependent chain + cinder + playground', () => {
    expect(expand('@cinder/diff')).toEqual([
      '@lostgradient/editor',
      '@cinder/diff',
      '@cinder/markdown',
      '@cinder/playground',
      '@lostgradient/chat',
      '@lostgradient/cinder',
    ]);
  });

  it('expands @cinder/testing to testing + cinder + playground', () => {
    expect(expand('@cinder/testing')).toEqual([
      '@cinder/playground',
      '@cinder/testing',
      '@lostgradient/chat',
      '@lostgradient/cinder',
    ]);
  });

  it('expands cinder through chat to playground', () => {
    expect(expand('@lostgradient/cinder')).toEqual([
      '@cinder/playground',
      '@lostgradient/chat',
      '@lostgradient/cinder',
    ]);
  });

  it('expands chat to chat + playground', () => {
    expect(expand('@lostgradient/chat')).toEqual(['@cinder/playground', '@lostgradient/chat']);
  });

  it('is cycle-safe and dedupes across multiple touched packages', () => {
    expect(
      sorted(expandToDependents(graphPackages, ['@cinder/diff', '@lostgradient/editor'])),
    ).toEqual([
      '@lostgradient/editor',
      '@cinder/diff',
      '@cinder/markdown',
      '@cinder/playground',
      '@lostgradient/chat',
      '@lostgradient/cinder',
    ]);
  });

  it('passes unknown names through unchanged', () => {
    expect(sorted(expandToDependents(graphPackages, ['@cinder/nonexistent']))).toEqual([
      '@cinder/nonexistent',
    ]);
  });

  it('returns an empty set when no packages are touched', () => {
    expect(sorted(expandToDependents(graphPackages, []))).toEqual([]);
  });
});

describe('buildableForwardClosure', () => {
  // Pins the exact prefixes of BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER so a
  // future reorder of that list (breaking the "every dependency points
  // strictly backward" invariant `buildableForwardClosure` relies on) fails
  // loudly here instead of silently under-building the pre-push pre-build
  // step and reopening the #364 race as a CI flake.
  it('closes @lostgradient/editor to diff + markdown + editor (its upstream chain)', () => {
    expect(buildableForwardClosure(new Set(['@lostgradient/editor']))).toEqual([
      '@cinder/diff',
      '@cinder/markdown',
      '@lostgradient/editor',
    ]);
  });

  it('closes @lostgradient/cinder to the full four-package chain', () => {
    expect(buildableForwardClosure(new Set(['@lostgradient/cinder']))).toEqual([
      '@cinder/diff',
      '@cinder/markdown',
      '@lostgradient/editor',
      '@lostgradient/cinder',
    ]);
  });

  it('does not over-build past the latest touched package', () => {
    expect(buildableForwardClosure(new Set(['@cinder/diff', '@cinder/markdown']))).toEqual([
      '@cinder/diff',
      '@cinder/markdown',
    ]);
  });

  it('returns an empty list when no buildable package is touched', () => {
    expect(buildableForwardClosure(new Set())).toEqual([]);
    expect(buildableForwardClosure(new Set(['@cinder/testing']))).toEqual([]);
  });
});

describe('isNewBranch', () => {
  it('is true when the remote sha is all zeros', () => {
    expect(isNewBranch({ localSha: 'a'.repeat(40), remoteSha: '0'.repeat(40) })).toBe(true);
  });

  it('is false when the remote sha is a real sha', () => {
    expect(isNewBranch({ localSha: 'a'.repeat(40), remoteSha: 'b'.repeat(40) })).toBe(false);
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

/** Build a fake GitRunner from canned responses keyed by call. */
function fakeGit(overrides: Partial<GitRunner>): GitRunner {
  return {
    mergeBase: overrides.mergeBase ?? (async () => 'base'),
    isAncestor: overrides.isAncestor ?? (async () => true),
    diffNames: overrides.diffNames ?? (async () => []),
    diffNameStatus: overrides.diffNameStatus ?? (async () => []),
  };
}

describe('changedFilesForRange', () => {
  const A = 'a'.repeat(40);
  const B = 'b'.repeat(40);
  const ZERO = '0'.repeat(40);

  it('uses a two-dot range for a fast-forward update', async () => {
    let seenRange = '';
    const git = fakeGit({
      isAncestor: async () => true,
      diffNames: async (range) => {
        seenRange = range;
        return ['packages/diff/src/x.ts'];
      },
    });
    const files = await changedFilesForRange([{ localSha: A, remoteSha: B }], git);
    expect(seenRange).toBe(`${B}..${A}`);
    expect([...files]).toEqual(['packages/diff/src/x.ts']);
  });

  it('uses the merge-base for a non-fast-forward (rebase) update', async () => {
    let seenRange = '';
    const git = fakeGit({
      isAncestor: async () => false,
      mergeBase: async () => 'mb',
      diffNames: async (range) => {
        seenRange = range;
        return [];
      },
    });
    await changedFilesForRange([{ localSha: A, remoteSha: B }], git);
    expect(seenRange).toBe(`mb..${A}`);
  });

  it('uses merge-base against origin/main for a new branch', async () => {
    const calls: string[] = [];
    const git = fakeGit({
      mergeBase: async (a, b) => {
        calls.push(`${a}|${b}`);
        return 'nb';
      },
      diffNames: async () => [],
    });
    await changedFilesForRange([{ localSha: A, remoteSha: ZERO }], git);
    expect(calls).toEqual([`origin/main|${A}`]);
  });

  it('honors the CINDER_PUSH_BASE_REF override for a new branch', async () => {
    const original = Bun.env['CINDER_PUSH_BASE_REF'];
    Bun.env['CINDER_PUSH_BASE_REF'] = 'origin/release';
    try {
      const calls: string[] = [];
      const git = fakeGit({
        mergeBase: async (a, b) => {
          calls.push(`${a}|${b}`);
          return 'nb';
        },
        diffNames: async () => [],
      });
      await changedFilesForRange([{ localSha: A, remoteSha: ZERO }], git);
      expect(calls).toEqual([`origin/release|${A}`]);
    } finally {
      if (original === undefined) delete Bun.env['CINDER_PUSH_BASE_REF'];
      else Bun.env['CINDER_PUSH_BASE_REF'] = original;
    }
  });

  it('throws when merge-base fails (→ caller falls back to full)', async () => {
    const git = fakeGit({
      mergeBase: async () => {
        throw new Error('no merge base');
      },
      diffNames: async () => [],
    });
    await expect(changedFilesForRange([{ localSha: A, remoteSha: ZERO }], git)).rejects.toThrow();
  });

  it('unions changed files across multiple updates and drops blanks', async () => {
    const git = fakeGit({
      diffNames: async () => [
        'packages/diff/a.ts',
        '',
        'packages/diff/a.ts',
        'packages/markdown/b.ts',
      ],
    });
    const files = await changedFilesForRange([{ localSha: A, remoteSha: B }], git);
    expect(sorted(files)).toEqual(['packages/diff/a.ts', 'packages/markdown/b.ts']);
  });

  it('returns an empty set and never shells out when given no updates', async () => {
    let called = false;
    const git = fakeGit({
      diffNames: async () => {
        called = true;
        return [];
      },
    });
    const files = await changedFilesForRange([], git);
    expect([...files]).toEqual([]);
    expect(called).toBe(false);
  });
});

describe('changedCssLikeFiles', () => {
  const A = 'a'.repeat(40);
  const B = 'b'.repeat(40);
  const update: PushRefUpdate = { localSha: A, remoteSha: B };
  const allExist = () => true;

  it('keeps modified/added css and svelte files', async () => {
    const git = fakeGit({
      diffNameStatus: async () => [
        'M\tpackages/components/a.css',
        'A\tpackages/components/b.svelte',
      ],
    });
    expect(await changedCssLikeFiles([update], git, allExist)).toEqual([
      'packages/components/a.css',
      'packages/components/b.svelte',
    ]);
  });

  it('drops deleted (D) css files', async () => {
    const git = fakeGit({
      diffNameStatus: async () => [
        'D\tpackages/components/gone.css',
        'M\tpackages/components/keep.css',
      ],
    });
    expect(await changedCssLikeFiles([update], git, allExist)).toEqual([
      'packages/components/keep.css',
    ]);
  });

  it('uses the destination path for a rename (R) and copy (C)', async () => {
    const git = fakeGit({
      diffNameStatus: async () => [
        'R100\tpackages/components/old.css\tpackages/components/new.css',
        'C100\tpackages/components/src.svelte\tpackages/components/copy.svelte',
      ],
    });
    expect(await changedCssLikeFiles([update], git, allExist)).toEqual([
      'packages/components/copy.svelte',
      'packages/components/new.css',
    ]);
  });

  it('ignores non-css/svelte files', async () => {
    const git = fakeGit({
      diffNameStatus: async () => ['M\tpackages/components/x.ts', 'M\tpackages/components/y.css'],
    });
    expect(await changedCssLikeFiles([update], git, allExist)).toEqual([
      'packages/components/y.css',
    ]);
  });

  it('drops files that no longer exist on disk', async () => {
    const git = fakeGit({
      diffNameStatus: async () => ['M\tpackages/components/a.css', 'M\tpackages/components/b.css'],
    });
    const exists = (path: string) => path.endsWith('a.css');
    expect(await changedCssLikeFiles([update], git, exists)).toEqual(['packages/components/a.css']);
  });

  it('handles a type-change (T) status the same as a modification', async () => {
    const git = fakeGit({
      diffNameStatus: async () => ['T\tpackages/components/a.css'],
    });
    expect(await changedCssLikeFiles([update], git, allExist)).toEqual([
      'packages/components/a.css',
    ]);
  });

  it('throws on an unrecognized diff status (→ caller falls back to full)', async () => {
    const git = fakeGit({
      diffNameStatus: async () => ['X\tpackages/components/weird.css'],
    });
    await expect(changedCssLikeFiles([update], git, allExist)).rejects.toThrow();
  });

  it('throws when a known status is missing its path (→ caller falls back to full)', async () => {
    const git = fakeGit({
      diffNameStatus: async () => ['R100\tpackages/components/old.css'], // no destination
    });
    await expect(changedCssLikeFiles([update], git, allExist)).rejects.toThrow();
  });
});

describe('isUnderWorkspace', () => {
  it('matches files inside a package directory', () => {
    expect(isUnderWorkspace('packages/diff/src/x.ts', graphPackages)).toBe(true);
    expect(isUnderWorkspace('packages/diff/fixtures/data.yaml', graphPackages)).toBe(true);
  });

  it('does not match root-level files', () => {
    expect(isUnderWorkspace('README.md', graphPackages)).toBe(false);
    expect(isUnderWorkspace('package.json', graphPackages)).toBe(false);
  });

  it('does not treat a directory prefix collision as a match', () => {
    expect(isUnderWorkspace('packages/diff-extra/x.ts', graphPackages)).toBe(false);
  });
});

describe('isIgnorableDoc', () => {
  it('ignores repo-root README/CHANGELOG', () => {
    expect(isIgnorableDoc('README.md', graphPackages)).toBe(true);
    expect(isIgnorableDoc('CHANGELOG.md', graphPackages)).toBe(true);
  });

  it('ignores package-root README/CHANGELOG and docs/**', () => {
    expect(isIgnorableDoc('packages/diff/README.md', graphPackages)).toBe(true);
    expect(isIgnorableDoc('packages/diff/CHANGELOG.md', graphPackages)).toBe(true);
    expect(isIgnorableDoc('packages/markdown/docs/intro.md', graphPackages)).toBe(true);
  });

  it('does NOT ignore a nested fixture named like a doc', () => {
    expect(
      isIgnorableDoc('packages/markdown/test/fixtures/README-edge-case.md', graphPackages),
    ).toBe(false);
    expect(isIgnorableDoc('packages/diff/fixtures/data.yaml', graphPackages)).toBe(false);
  });

  it('does NOT ignore a non-doc root-level file', () => {
    expect(isIgnorableDoc('bun.lock', graphPackages)).toBe(false);
    expect(isIgnorableDoc('package.json', graphPackages)).toBe(false);
  });
});

/**
 * Reproduce the exact scope-derivation the pre-push hook performs (lint scoped
 * naively to touched packages; typecheck/test expanded to the reverse-dependency
 * closure) so the motivating CSS-only acceptance criterion is asserted against
 * the *real* workspace, not just the building blocks in isolation.
 */
describe('prePushPackageScript', () => {
  it('uses component-aware test scoping for the cinder package only', () => {
    expect(prePushPackageScript('@lostgradient/cinder', 'test')).toBe('test:changed');
    expect(prePushPackageScript('@lostgradient/cinder', 'typecheck')).toBe('typecheck');
    expect(prePushPackageScript('@cinder/playground', 'test')).toBe('test');
  });
});

describe('withGateLock', () => {
  class SignalIntercepted extends Error {}

  async function withTemporaryLockPath<T>(test: (lockPath: string) => Promise<T>): Promise<T> {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-gate-lock-'));
    try {
      return await test(join(directory, 'local-validation-gate.lock'));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }

  it('derives a deterministic lock path from the worktree root', () => {
    const expectedPath = gateLockPathForWorktreeRoot(REPO_ROOT);

    expect(defaultGateLockPath()).toBe(expectedPath);
    expect(defaultGateLockPath(REPO_ROOT)).toBe(expectedPath);
  });

  it('isolates linked worktrees while sharing a path within one worktree', () => {
    const firstWorktree = '/tmp/cinder-worktree-a';
    const secondWorktree = '/tmp/cinder-worktree-b';

    expect(gateLockPathForWorktreeRoot(firstWorktree)).toBe(
      gateLockPathForWorktreeRoot(firstWorktree),
    );
    expect(gateLockPathForWorktreeRoot(firstWorktree)).not.toBe(
      gateLockPathForWorktreeRoot(secondWorktree),
    );
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

  it('keeps waiting past the legacy timeout while the recorded holder remains alive', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      const legacyTimeoutMilliseconds = 5;
      const holder = Bun.spawn(['bun', '-e', 'await Bun.stdin.text()'], {
        stderr: 'ignore',
        stdin: 'pipe',
        stdout: 'ignore',
      });
      let liveChecks = 0;

      try {
        await writeFile(
          lockPath,
          JSON.stringify({
            createdAt: new Date(Date.now() - 10 * 60 * 1_000).toISOString(),
            pid: holder.pid,
            repositoryRoot: 'other-checkout',
            token: 'still-running',
          }),
        );

        const result = await withGateLock(async () => 'acquired after holder exited', {
          isProcessAlive: (pid) => {
            const alive = isProcessAlive(pid);
            if (alive && ++liveChecks === 10) holder.stdin.end();
            return alive;
          },
          lockPath,
          retryMilliseconds: 1,
          waitMilliseconds: legacyTimeoutMilliseconds,
        });

        expect(result).toBe('acquired after holder exited');
        expect(liveChecks).toBeGreaterThanOrEqual(10);
        expect(await holder.exited).toBe(0);
        expect(await Bun.file(lockPath).exists()).toBe(false);
      } finally {
        if (isProcessAlive(holder.pid)) {
          holder.stdin.end();
          killProcessGroup(holder.pid);
        }
        await holder.exited;
      }
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

  it('starts a fresh bounded wait when a live lock is replaced by a malformed lock', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(
        lockPath,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          pid: 123,
          repositoryRoot: 'other-checkout',
          token: 'live-then-malformed',
        }),
      );
      let liveChecks = 0;
      let malformedChecks = 0;
      let now = 0;

      await expect(
        withGateLock(async () => 'should not run', {
          beforeMalformedLockStat: () => {
            malformedChecks++;
            if (malformedChecks > 1) now = 5;
          },
          isProcessAlive: () => {
            if (++liveChecks === 20) writeFileSync(lockPath, '{');
            return true;
          },
          lockPath,
          malformedLockGraceMilliseconds: 1_000,
          now: () => now,
          retryMilliseconds: 1,
          waitMilliseconds: 5,
        }),
      ).rejects.toThrow('malformed lock');

      expect(malformedChecks).toBeGreaterThan(1);
      expect(await readFile(lockPath, 'utf8')).toBe('{');
    });
  });

  it('prints live-holder guidance after a malformed lock becomes valid', async () => {
    await withTemporaryLockPath(async (lockPath) => {
      await writeFile(lockPath, '{');
      const messages: string[] = [];
      const consoleLog = spyOn(console, 'log').mockImplementation((message) => {
        messages.push(String(message));
      });
      let lockCompleted = false;
      let liveChecks = 0;

      try {
        const result = await withGateLock(async () => 'acquired after transition', {
          beforeMalformedLockStat: async () => {
            if (lockCompleted) return;
            lockCompleted = true;
            await writeFile(
              lockPath,
              JSON.stringify({
                createdAt: new Date().toISOString(),
                pid: 123,
                repositoryRoot: 'other-checkout',
                token: 'completed-lock',
              }),
            );
          },
          isProcessAlive: () => ++liveChecks === 1,
          lockPath,
          malformedLockGraceMilliseconds: 1_000,
          retryMilliseconds: 1,
          waitMilliseconds: 100,
        });

        expect(result).toBe('acquired after transition');
        expect(messages.some((message) => message.includes('preparing its lock file'))).toBe(true);
        expect(messages.some((message) => message.includes('Waiting without an age timeout'))).toBe(
          true,
        );
      } finally {
        consoleLog.mockRestore();
      }
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

describe('nodeModulesTopology', () => {
  it('reports a real directory as real', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-node-modules-real-'));
    try {
      await mkdir(join(directory, 'node_modules'));

      expect(nodeModulesTopology(directory)).toBe('real');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('reports a non-directory, non-symlink node_modules as invalid', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-node-modules-invalid-'));
    try {
      await writeFile(join(directory, 'node_modules'), 'not a directory');

      expect(nodeModulesTopology(directory)).toBe('invalid');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('reports an absent node_modules as missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-node-modules-missing-'));
    try {
      expect(nodeModulesTopology(directory)).toBe('missing');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  // The regression this whole guard exists for: a symlinked node_modules
  // resolves to a healthy directory, so anything using `stat` instead of
  // `lstat` reports 'real' and misses the defect entirely.
  it('reports a symlink to a healthy tree as symlinked, not real', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cinder-node-modules-symlink-'));
    try {
      const target = join(directory, 'primary-node-modules');
      await mkdir(target);
      await symlink(
        target,
        join(directory, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      expect(nodeModulesTopology(directory)).toBe('symlinked');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
