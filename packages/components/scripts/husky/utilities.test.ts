import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  changedCssLikeFiles,
  changedFilesForRange,
  cleanupForHookSignal,
  cleanupHookProcesses,
  expandToDependents,
  formatFailureSummary,
  getTouchedPackages,
  hasRootConfigurationChanges,
  inferFailureScope,
  isIgnorableDoc,
  isNewBranch,
  isSourceFile,
  isUnderWorkspace,
  loadWorkspacePackages,
  parsePushRefs,
  runHookCommand,
  summarizeFailures,
  withGateLock,
  type GitRunner,
  type PushRefUpdate,
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
  pkg('cinder', 'packages/components/', [], { hasTest: false }),
];

// A fixture mirroring the real internal dependency graph for closure tests.
const graphPackages: readonly WorkspacePackage[] = [
  pkg('cinder', 'packages/components/', [
    '@cinder/commentary',
    '@cinder/diff',
    '@cinder/editor',
    '@cinder/markdown',
    '@cinder/testing',
  ]),
  pkg('@cinder/markdown', 'packages/markdown/', ['@cinder/diff']),
  pkg('@cinder/editor', 'packages/editor/', ['@cinder/markdown']),
  pkg('@cinder/commentary', 'packages/commentary/', ['@cinder/editor', '@cinder/markdown']),
  pkg('@cinder/playground', 'packages/playground/', ['cinder']),
  pkg('@cinder/diff', 'packages/diff/'),
  pkg('@cinder/testing', 'packages/testing/', [], { hasLint: false }),
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
    expect(names).toContain('@cinder/editor');
    expect(names).toContain('@cinder/commentary');
    expect(names).toContain('@cinder/playground');
    expect(names).toContain('@cinder/testing');
    expect(names).toContain('cinder');
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
    expect([...byName.get('@cinder/playground')!.dependencies]).toContain('cinder');
    // @cinder/markdown depends on @cinder/diff.
    expect([...byName.get('@cinder/markdown')!.dependencies]).toContain('@cinder/diff');
    // cinder dev-depends on @cinder/testing.
    expect([...byName.get('cinder')!.dependencies]).toContain('@cinder/testing');
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

describe('expandToDependents', () => {
  // NOTE: the real graph has `cinder` dev-depending on every sub-package (its
  // own tests import them) AND `@cinder/playground` depending on `cinder`. So
  // any sub-package change pulls in `cinder` + `@cinder/playground` as
  // dependents. Only `@cinder/commentary` (a true leaf in the consumer
  // direction) and `@cinder/playground` stay small. These expectations are the
  // sound closures, computed from the graph — not the smaller sets an earlier
  // draft assumed.
  const expand = (name: string) => sorted(expandToDependents(graphPackages, [name]));

  it('keeps @cinder/playground a leaf (nothing depends on it)', () => {
    expect(expand('@cinder/playground')).toEqual(['@cinder/playground']);
  });

  it('expands @cinder/commentary to commentary + cinder + playground', () => {
    expect(expand('@cinder/commentary')).toEqual([
      '@cinder/commentary',
      '@cinder/playground',
      'cinder',
    ]);
  });

  it('expands @cinder/editor to editor + commentary + cinder + playground', () => {
    expect(expand('@cinder/editor')).toEqual([
      '@cinder/commentary',
      '@cinder/editor',
      '@cinder/playground',
      'cinder',
    ]);
  });

  it('expands @cinder/markdown to markdown + editor + commentary + cinder + playground', () => {
    expect(expand('@cinder/markdown')).toEqual([
      '@cinder/commentary',
      '@cinder/editor',
      '@cinder/markdown',
      '@cinder/playground',
      'cinder',
    ]);
  });

  it('expands @cinder/diff to the full dependent chain + cinder + playground', () => {
    expect(expand('@cinder/diff')).toEqual([
      '@cinder/commentary',
      '@cinder/diff',
      '@cinder/editor',
      '@cinder/markdown',
      '@cinder/playground',
      'cinder',
    ]);
  });

  it('expands @cinder/testing to testing + cinder + playground', () => {
    expect(expand('@cinder/testing')).toEqual(['@cinder/playground', '@cinder/testing', 'cinder']);
  });

  it('expands cinder to cinder + playground', () => {
    expect(expand('cinder')).toEqual(['@cinder/playground', 'cinder']);
  });

  it('is cycle-safe and dedupes across multiple touched packages', () => {
    expect(sorted(expandToDependents(graphPackages, ['@cinder/diff', '@cinder/editor']))).toEqual([
      '@cinder/commentary',
      '@cinder/diff',
      '@cinder/editor',
      '@cinder/markdown',
      '@cinder/playground',
      'cinder',
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
function planScopedJobs(
  workspace: readonly WorkspacePackage[],
  changed: readonly string[],
): string[] {
  const touched = getTouchedPackages(workspace, [...changed]);
  const byName = new Map(workspace.map((entry) => [entry.name, entry] as const));
  const jobs: string[] = [];
  for (const entry of touched) {
    if (entry.hasLint) jobs.push(`${entry.name} lint`);
  }
  for (const name of expandToDependents(
    workspace,
    touched.map((entry) => entry.name),
  )) {
    const entry = byName.get(name);
    if (entry === undefined) continue;
    if (entry.hasTypecheck) jobs.push(`${name} typecheck`);
    if (entry.hasTest) jobs.push(`${name} test`);
  }
  return jobs.toSorted();
}

describe('scoped job derivation (real workspace)', () => {
  it('scopes a CSS-only packages/components change to cinder + playground only', async () => {
    const workspace = await loadWorkspacePackages();
    const jobs = planScopedJobs(workspace, [
      'packages/components/src/components/alert.css',
      'packages/components/src/components/callout.css',
    ]);
    // Positive: cinder's three gates plus playground typecheck/test (closure).
    expect(jobs).toEqual([
      '@cinder/playground test',
      '@cinder/playground typecheck',
      'cinder lint',
      'cinder test',
      'cinder typecheck',
    ]);
    // Negative: no playground *lint* (closure is typecheck/test only), and no
    // markdown/editor/commentary/diff jobs at all.
    expect(jobs).not.toContain('@cinder/playground lint');
    expect(jobs.some((j) => /@cinder\/(markdown|editor|commentary|diff)/.test(j))).toBe(false);
  });

  it('scopes a leaf @cinder/commentary change without dragging in unrelated siblings', async () => {
    const workspace = await loadWorkspacePackages();
    const jobs = planScopedJobs(workspace, ['packages/commentary/src/index.ts']);
    // commentary is a consumer leaf, but cinder dev-depends on it and playground
    // depends on cinder, so the closure is commentary + cinder + playground.
    expect(jobs.some((j) => /@cinder\/(markdown|editor|diff)/.test(j))).toBe(false);
    expect(jobs).toContain('@cinder/commentary lint');
    expect(jobs).toContain('cinder typecheck');
    expect(jobs).toContain('@cinder/playground test');
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
