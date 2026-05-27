import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getTouchedPackages,
  isSourceFile,
  loadWorkspacePackages,
  rootConfigStaged,
  withGateLock,
  type WorkspacePackage,
} from './utilities.ts';

const fakePackages: readonly WorkspacePackage[] = [
  { name: '@cinder/diff', dir: 'packages/diff/', hasTypecheck: true, hasTest: true },
  { name: '@cinder/markdown', dir: 'packages/markdown/', hasTypecheck: true, hasTest: true },
  { name: 'cinder', dir: 'packages/components/', hasTypecheck: true, hasTest: false },
];

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
      const entries: string[] = [];

      const firstGate = withGateLock(
        async () => {
          entries.push('first');
          await firstGateReleased;
        },
        { lockPath, retryMilliseconds: 1, waitMilliseconds: 100 },
      );

      while (!(await Bun.file(lockPath).exists())) {
        await Bun.sleep(1);
      }

      const secondGate = withGateLock(
        async () => {
          entries.push('second');
        },
        { lockPath, retryMilliseconds: 1, waitMilliseconds: 100 },
      );

      await Bun.sleep(5);
      expect(entries).toEqual(['first']);

      releaseFirstGate();
      await Promise.all([firstGate, secondGate]);

      expect(entries).toEqual(['first', 'second']);
      expect(await Bun.file(lockPath).exists()).toBe(false);
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
    it(`removes the lock before re-sending ${signal}`, async () => {
      await withTemporaryLockPath(async (lockPath) => {
        let receivedSignal: NodeJS.Signals | undefined;
        await expect(
          withGateLock(
            async () => {
              expect(await Bun.file(lockPath).exists()).toBe(true);
              process.emit(signal);
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

        expect(receivedSignal).toBe(signal);
        expect(await Bun.file(lockPath).exists()).toBe(false);
      });
    });
  }
});
