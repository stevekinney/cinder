import { describe, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forceStopUnverifiedSupervisor, spawnManagedProcess } from './managed-process-spawn.ts';

import {
  parseDarwinProcessInfo,
  parseLinuxProcessStat,
  parseProcessSnapshot,
  type ProcessIdentity,
} from './process-identity.ts';
import {
  childProcessHasFinished,
  cleanupManagedChildren,
  createCleanupOnce,
  descendantProcessIds,
  installSignalCleanupHandlers,
  manageChildProcess,
  parseProcessGroupSnapshot,
  parseProcessTreeSnapshot,
  terminateChildProcess,
  waitForExit,
} from './process-lifecycle.ts';
import {
  appendServerOutputBuffer,
  clearTrackedTimer,
  enqueueOrderedBuild,
  finalPlaywrightExitCode,
  localPlaygroundUrlForReportedPort,
  parsePlaygroundFingerprintHeader,
  parsePlaygroundListeningPort,
  playgroundBundleDependencyBuildArguments,
  playgroundBundleDependencyBuildPackages,
  playgroundBundleDependencyBuildProcess,
  playgroundBundleDependencySourceDirectories,
  playgroundServerArguments,
  playgroundServerWorkingDirectory,
  playgroundUrlForPath,
  playgroundWarmReadinessEndpointPath,
  playgroundWarmReadinessMissingEndpointMessage,
  playwrightCommandArguments,
  playwrightProcessEnvironment,
  respondingPlaygroundUrl,
  shouldBuildPlaygroundBundleDependencies,
  shouldRefuseStaleServerReuse,
  shouldStartManagedChildProcess,
  shutdownExitCodeAfterRequest,
  stalePlaygroundServerMessage,
  takeNextOrderedBuild,
  waitForPlaygroundReadinessWithCleanup,
} from './start-server.ts';

describe('parsePlaygroundListeningPort', () => {
  test('reads the playground port from direct server output', () => {
    expect(parsePlaygroundListeningPort('[playground] Listening at http://localhost:5555')).toBe(
      5555,
    );
  });

  test('reads the playground port from package-runner-prefixed output', () => {
    expect(
      parsePlaygroundListeningPort(
        '@cinder/playground dev: [playground] Listening at http://localhost:5556',
      ),
    ).toBe(5556);
  });

  test('reads the latest playground port from accumulated output', () => {
    expect(
      parsePlaygroundListeningPort(
        [
          '[playground] Listening at http://localhost:5555',
          '[playground] Restarting after file change',
          '[playground] Listening at http://localhost:5557',
        ].join('\n'),
      ),
    ).toBe(5557);
  });

  test('returns null when output does not include a playground listening line', () => {
    expect(parsePlaygroundListeningPort('[playground] Pre-built 63/63 page bundles')).toBeNull();
  });
});

describe('localPlaygroundUrlForReportedPort', () => {
  test('returns null before the spawned server reports a selected port', () => {
    expect(localPlaygroundUrlForReportedPort(null)).toBeNull();
  });

  test('returns the local playground URL for a reported port', () => {
    expect(localPlaygroundUrlForReportedPort(5556)).toBe('http://localhost:5556');
  });
});

describe('respondingPlaygroundUrl', () => {
  test('accepts one successful readiness probe without immediately probing again', async () => {
    let probeCount = 0;
    const respondingUrl = await respondingPlaygroundUrl(5556, 'http://localhost:5555', async () => {
      probeCount += 1;
      return probeCount === 1;
    });

    expect(respondingUrl).toBe('http://localhost:5556');
    expect(probeCount).toBe(1);
  });

  test('probes the fallback URL once when no port is reported', async () => {
    const probedUrls: string[] = [];

    await respondingPlaygroundUrl(null, 'http://localhost:5555', async (url) => {
      probedUrls.push(url);
      return false;
    });

    expect(probedUrls).toEqual(['http://localhost:5555']);
  });
});

describe('appendServerOutputBuffer', () => {
  test('keeps the full startup buffer until a listening port has been reported', () => {
    const linePrefix = '[playground] Listening at http://localhost:';
    const oversizedOutput = 'x'.repeat(5000);

    const buffer = appendServerOutputBuffer(linePrefix, oversizedOutput, false);

    expect(buffer.startsWith(linePrefix)).toBe(true);
    expect(buffer.length).toBeGreaterThan(4096);
  });

  test('trims accumulated output after a listening port has been reported', () => {
    const buffer = appendServerOutputBuffer('x'.repeat(5000), 'done', true);

    expect(buffer.length).toBe(4096);
    expect(buffer.endsWith('done')).toBe(true);
  });
});

describe('playground bundle dependency build preflight', () => {
  test('skips duplicate builds only after CI has prebuilt the exact Turbo graph', () => {
    expect(shouldBuildPlaygroundBundleDependencies({ PLAYGROUND_DEPENDENCIES_PREBUILT: '1' })).toBe(
      false,
    );
    expect(shouldBuildPlaygroundBundleDependencies({})).toBe(true);
  });

  test('builds every workspace package the playground browser bundle resolves through dist', () => {
    expect(playgroundBundleDependencyBuildPackages()).toEqual([
      '@lostgradient/markdown',
      '@lostgradient/editor',
      '@lostgradient/cinder',
      '@lostgradient/chat',
    ]);
  });

  test('build arguments use Bun workspace filters', () => {
    expect(playgroundBundleDependencyBuildArguments('@lostgradient/markdown')).toEqual([
      'run',
      '--filter=@lostgradient/markdown',
      'build',
    ]);
  });

  test('registers dependency builds as managed child processes', () => {
    const childProcess = {} as ChildProcess;
    const managedChildProcess = playgroundBundleDependencyBuildProcess(
      childProcess,
      '@lostgradient/markdown',
    );

    expect(managedChildProcess.childProcess).toBe(childProcess);
    expect(managedChildProcess.name).toBe('@lostgradient/markdown build');
  });

  test('watches package source and build-script directories explicitly', () => {
    expect(playgroundBundleDependencySourceDirectories('@lostgradient/markdown')).toEqual([
      expect.stringMatching(/packages\/markdown\/src$/),
      expect.stringMatching(/packages\/markdown\/scripts$/),
    ]);
    expect(playgroundBundleDependencySourceDirectories('@lostgradient/cinder')).toEqual([
      expect.stringMatching(/packages\/components\/src$/),
      expect.stringMatching(/packages\/components\/scripts$/),
    ]);
  });
});

describe('playground server process', () => {
  test('leaves runtime edits to the managed source and dependency watchers', () => {
    const argumentsList = playgroundServerArguments();

    expect(argumentsList).toEqual(['run', 'src/playground-server.ts']);
    expect(argumentsList).not.toContain('dev');
    expect(argumentsList).not.toContain('--watch');
    expect(playgroundServerWorkingDirectory().endsWith(join('packages', 'playground'))).toBe(true);
  });
});

describe('dependency rebuild scheduling', () => {
  test('dequeues the lowest-order build from the actual queue', () => {
    const queue = [{ order: 2 }, { order: 0 }, { order: 1 }];

    expect(takeNextOrderedBuild(queue)).toEqual({ order: 0 });
    expect(queue).toEqual([{ order: 1 }, { order: 2 }]);
  });

  test('queues at most one pending build per package order', () => {
    const queue = [{ order: 1, run: () => {} }];
    const duplicate = { order: 1, run: () => {} };

    enqueueOrderedBuild(queue, duplicate);

    expect(queue).toHaveLength(1);
    expect(queue[0]).not.toBe(duplicate);
  });

  test('removes a superseded debounce timer from the tracked set', () => {
    const timer = setTimeout(() => {}, 60_000);
    const timers = new Set([timer]);

    clearTrackedTimer(timer, timers);

    expect(timers.size).toBe(0);
  });
});

describe('playground readiness cleanup', () => {
  test('cleans up a managed server whenever a readiness check fails', async () => {
    const calls: string[] = [];
    const readinessError = new Error('not warm');

    await expect(
      waitForPlaygroundReadinessWithCleanup(
        () => Promise.reject(readinessError),
        () => {
          calls.push('shutdown-check');
          return Promise.resolve();
        },
        () => {
          calls.push('cleanup');
          return Promise.resolve();
        },
      ),
    ).rejects.toBe(readinessError);
    expect(calls).toEqual(['shutdown-check', 'cleanup']);
  });
});

describe('child process cleanup', () => {
  async function withProcessKillSpy(
    callback: (signals: string[]) => Promise<void>,
  ): Promise<string[]> {
    const originalKill = process.kill;
    const signals: string[] = [];
    process.kill = (_pid, signal) => {
      if (typeof signal === 'string') signals.push(signal);
      return true;
    };
    try {
      await callback(signals);
    } finally {
      process.kill = originalKill;
    }
    return signals;
  }

  test('finds only descendants in a captured process tree', () => {
    const snapshot = parseProcessTreeSnapshot(
      ['10 1', '11 10', '12 11', '13 99', '14 1'].join('\n'),
    );

    expect(descendantProcessIds(10, snapshot)).toEqual([11, 12]);
  });

  test('parses process groups without widening ownership to a sentinel', () => {
    expect(parseProcessGroupSnapshot('10 10\n11 10\n12 99')).toEqual([
      { pid: 10, groupId: 10 },
      { pid: 11, groupId: 10 },
      { pid: 12, groupId: 99 },
    ]);
  });

  test('parses process start identity alongside parent and process-group ownership', () => {
    expect(
      parseProcessSnapshot('10 1 10 Mon Sep 14 22:12:55 2026\n11 10 10 Mon Sep 14 22:12:56 2026'),
    ).toEqual([
      { pid: 10, parentPid: 1, groupId: 10, startTime: 'Mon Sep 14 22:12:55 2026' },
      { pid: 11, parentPid: 10, groupId: 10, startTime: 'Mon Sep 14 22:12:56 2026' },
    ]);
  });

  test('parses Linux process identity when the command name contains parentheses', () => {
    const stat = `123 (worker (nested)) S ${[
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    ].join(' ')}`;

    expect(parseLinuxProcessStat(123, stat, 'boot-id')).toEqual({
      pid: 123,
      parentPid: 10,
      groupId: 11,
      startTime: 'boot-id:28',
    });
  });

  test('rejects malformed Linux and short Darwin process identity reads', () => {
    expect(parseLinuxProcessStat(123, '123 (worker) S 1', 'boot-id')).toBeNull();
    expect(
      parseDarwinProcessInfo(new ArrayBuffer(8), { pid: 123, parentPid: 1, groupId: 123 }),
    ).toBeNull();
  });

  test('reads the Darwin birth identity fields validated against the SDK layout', () => {
    const buffer = new ArrayBuffer(136);
    const view = new DataView(buffer);
    view.setUint32(12, 123, true);
    view.setUint32(16, 1, true);
    view.setUint32(100, 123, true);
    view.setBigUint64(120, 1789446830n, true);
    view.setBigUint64(128, 842702n, true);
    expect(parseDarwinProcessInfo(buffer, { pid: 123, parentPid: 1, groupId: 123 })).toBe(
      '1789446830:842702',
    );
  });

  test('does not signal a reused pid with the same-second but different precise birth identity', async () => {
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    const previousIdentity: ProcessIdentity = {
      pid: sentinel.pid!,
      parentPid: process.pid,
      groupId: process.pid,
      startTime: '1789446830:842701',
    };
    const reusedIdentity: ProcessIdentity = {
      ...previousIdentity,
      startTime: '1789446830:842702',
    };

    try {
      await terminateChildProcess({
        childProcess: {
          pid: sentinel.pid,
          exitCode: 0,
          signalCode: null,
          stdout: null,
          stderr: null,
        } as ChildProcess,
        name: 'reused pid fixture',
        ownedProcessIdentities: new Map([[sentinel.pid!, previousIdentity]]),
        processSnapshot: () => [reusedIdentity],
      });
      expect(() => process.kill(sentinel.pid!, 0)).not.toThrow();
    } finally {
      if (sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill('SIGTERM');
    }
  });

  test('does not discover members from a reused process group', async () => {
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    const rootIdentity: ProcessIdentity = {
      pid: sentinel.pid!,
      parentPid: process.pid,
      groupId: sentinel.pid!,
      startTime: '1789446830:842701',
    };
    const reusedRoot = { ...rootIdentity, startTime: '1789446830:842702' };
    const unrelatedMember = {
      pid: sentinel.pid! + 1,
      parentPid: 1,
      groupId: sentinel.pid!,
      startTime: '1789446830:842702',
    };

    try {
      await terminateChildProcess({
        childProcess: {
          pid: sentinel.pid,
          exitCode: 0,
          signalCode: null,
          stdout: null,
          stderr: null,
        } as ChildProcess,
        name: 'reused process group fixture',
        ownedProcessIdentities: new Map(),
        processSnapshot: () => [reusedRoot, unrelatedMember],
        rootProcessIdentity: rootIdentity,
        ownedProcessGroupId: sentinel.pid!,
      });
      expect(() => process.kill(sentinel.pid!, 0)).not.toThrow();
    } finally {
      if (sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill('SIGTERM');
    }
  });

  test('rejects finished-root cleanup when the identity snapshot is unavailable', async () => {
    await expect(
      terminateChildProcess({
        childProcess: {
          pid: 123,
          exitCode: 0,
          signalCode: null,
          stdout: null,
          stderr: null,
        } as ChildProcess,
        name: 'unverified finished fixture',
        processSnapshot: () => null,
      }),
    ).rejects.toThrow('snapshot unavailable');
  });

  test('rejects cleanup when a partial snapshot cannot read a cached live identity', async () => {
    const expected: ProcessIdentity = {
      pid: 123,
      parentPid: 1,
      groupId: 123,
      startTime: 'boot:42',
    };
    await expect(
      terminateChildProcess({
        childProcess: {
          pid: 123,
          exitCode: 0,
          signalCode: null,
          stdout: null,
          stderr: null,
        } as ChildProcess,
        name: 'partial identity fixture',
        ownedProcessIdentities: new Map([[expected.pid, expected]]),
        processSnapshot: () => ({ identities: [], complete: false, observedPids: [expected.pid] }),
      }),
    ).rejects.toThrow('cached process identity');
  });

  test('waits through an unrelated partial read before a cached identity disappears', async () => {
    const expected: ProcessIdentity = {
      pid: 123,
      parentPid: 1,
      groupId: 123,
      startTime: 'boot:42',
    };
    const snapshots = [
      { identities: [expected], complete: false, observedPids: [expected.pid, 999] },
      { identities: [expected], complete: false, observedPids: [expected.pid, 999] },
      { identities: [expected], complete: false, observedPids: [expected.pid, 999] },
      { identities: [], complete: true, observedPids: [] },
    ];
    let index = 0;
    const childProcess = {
      pid: expected.pid,
      exitCode: 0,
      signalCode: null,
      stdout: null,
      stderr: null,
      kill: () => false,
    } as unknown as ChildProcess;
    const signals = await withProcessKillSpy(async () => {
      await expect(
        terminateChildProcess({
          childProcess,
          name: 'partial transition fixture',
          ownedProcessIdentities: new Map([[expected.pid, expected]]),
          processSnapshot: () => snapshots[Math.min(index++, snapshots.length - 1)]!,
        }),
      ).resolves.toBeUndefined();
    });
    expect(signals).toEqual(['SIGTERM']);
  });

  test('resolves a complete mixture of absent and reused identities immediately', async () => {
    const absent: ProcessIdentity = { pid: 123, parentPid: 1, groupId: 123, startTime: 'boot:1' };
    const reused: ProcessIdentity = { pid: 124, parentPid: 1, groupId: 124, startTime: 'boot:2' };
    const replacement = { ...reused, startTime: 'boot:3' };
    const snapshot = { identities: [replacement], complete: true, observedPids: [124] };
    let snapshotReads = 0;
    const signals = await withProcessKillSpy(async () => {
      await expect(
        terminateChildProcess({
          childProcess: {
            pid: 500,
            exitCode: 0,
            signalCode: null,
            stdout: null,
            stderr: null,
          } as ChildProcess,
          name: 'mixed identity fixture',
          ownedProcessIdentities: new Map([
            [absent.pid, absent],
            [reused.pid, reused],
          ]),
          processSnapshot: () => {
            snapshotReads++;
            return snapshot;
          },
        }),
      ).resolves.toBeUndefined();
    });
    expect(signals).toEqual([]);
    expect(snapshotReads).toBeLessThanOrEqual(4);
  });

  test('allows a finished-root partial PID reuse without signaling the replacement', async () => {
    const expected: ProcessIdentity = { pid: 123, parentPid: 1, groupId: 123, startTime: 'boot:1' };
    const replacement = { ...expected, startTime: 'boot:2' };
    const snapshot = { identities: [replacement], complete: false, observedPids: [expected.pid] };
    const signals = await withProcessKillSpy(async () => {
      await expect(
        terminateChildProcess({
          childProcess: {
            pid: expected.pid,
            exitCode: 0,
            signalCode: null,
            stdout: null,
            stderr: null,
          } as ChildProcess,
          name: 'reused finished fixture',
          ownedProcessIdentities: new Map([[expected.pid, expected]]),
          processSnapshot: () => snapshot,
        }),
      ).resolves.toBeUndefined();
    });
    expect(signals).toEqual([]);
  });

  test('does not discover a new group member from a finished anchored root', async () => {
    const root: ProcessIdentity = { pid: 123, parentPid: 1, groupId: 123, startTime: 'boot:1' };
    const newMember: ProcessIdentity = {
      pid: 124,
      parentPid: 1,
      groupId: 123,
      startTime: 'boot:2',
    };
    const snapshot = { identities: [root, newMember], complete: true, observedPids: [123, 124] };
    const signals = await withProcessKillSpy(async () => {
      await expect(
        terminateChildProcess({
          childProcess: {
            pid: root.pid,
            exitCode: 0,
            signalCode: null,
            stdout: null,
            stderr: null,
          } as ChildProcess,
          name: 'finished group fixture',
          ownedProcessIdentities: new Map(),
          rootProcessIdentity: root,
          ownedProcessGroupId: root.pid,
          processSnapshot: () => snapshot,
        }),
      ).resolves.toBeUndefined();
    });
    expect(signals).toEqual([]);
  });

  test.each([
    ['normal exit', 0, null],
    ['child failure', 1, null],
    ['SIGINT shutdown', 0, 130],
    ['SIGTERM shutdown', 0, 143],
    ['playground death during browser work', 137, null],
  ] as const)(
    '%s cleans the real server/browser ownership set',
    async (_label, serverExit, triggerCode) => {
      const temporaryRoot = mkdtempSync(join(tmpdir(), 'cinder-lifecycle-'));
      const ownershipFile = join(temporaryRoot, 'playground-port.txt');
      writeFileSync(ownershipFile, 'owned');
      const serverLifetimeMs = 1_000;
      const server = spawnManagedProcess(
        process.execPath,
        [
          '-e',
          [
            "const { spawn } = require('node:child_process');",
            "const http = require('node:http');",
            "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
            "const server = http.createServer((_request, response) => response.end('ok'));",
            "server.listen(0, '127.0.0.1', () => { process.stdout.write(JSON.stringify({ grandchildPid: grandchild.pid, port: server.address().port }) + '\\n'); });",
            `setTimeout(() => process.exit(${serverExit}), ${serverLifetimeMs});`,
          ].join(' '),
        ],
        { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const browser = spawnManagedProcess(
        process.execPath,
        [
          '-e',
          [
            "const { spawn } = require('node:child_process');",
            "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
            "process.stdout.write(String(grandchild.pid) + '\\n');",
            'setInterval(() => {}, 1000);',
          ].join(' '),
        ],
        { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        detached: process.platform !== 'win32',
        stdio: 'ignore',
      });
      const managedServer = playgroundBundleDependencyBuildProcess(
        server,
        'lifecycle server',
        process.platform !== 'win32',
      );
      const managedBrowser = playgroundBundleDependencyBuildProcess(
        browser,
        'lifecycle browser',
        process.platform !== 'win32',
      );
      const serverClosed = once(server, 'close');
      const browserClosed = once(browser, 'close');

      try {
        const [serverOutput] = await once(server.stdout!, 'data');
        const [browserOutput] = await once(browser.stdout!, 'data');
        const serverDetails = JSON.parse(String(serverOutput).trim()) as {
          grandchildPid: number;
          port: number;
        };
        const browserGrandchildPid = Number(String(browserOutput).trim());
        const ownedPids = [
          server.pid!,
          serverDetails.grandchildPid,
          browser.pid!,
          browserGrandchildPid,
        ];
        const response = await fetch(`http://127.0.0.1:${serverDetails.port}`);
        expect(await response.text()).toBe('ok');
        if (triggerCode === 130 || triggerCode === 143) {
          server.kill(triggerCode === 130 ? 'SIGINT' : 'SIGTERM');
        }
        await once(server, 'exit');
        if (serverExit === 137) {
          expect(server.exitCode).toBe(137);
          expect(server.signalCode).toBeNull();
        } else if (triggerCode === 130 || triggerCode === 143) {
          expect(server.exitCode).toBeNull();
          expect(server.signalCode).toBe(triggerCode === 130 ? 'SIGINT' : 'SIGTERM');
        } else if (triggerCode === null) {
          expect(server.exitCode).toBe(serverExit);
        }
        await cleanupManagedChildren([managedServer, managedBrowser], ownershipFile);
        await cleanupManagedChildren([managedServer, managedBrowser], ownershipFile);

        await Promise.all([serverClosed, browserClosed]);
        for (const pid of ownedPids) expect(() => process.kill(pid, 0)).toThrow();
        expect(() => process.kill(sentinel.pid!, 0)).not.toThrow();
        expect(existsSync(ownershipFile)).toBe(false);
        await expect(fetch(`http://127.0.0.1:${serverDetails.port}`)).rejects.toThrow();
        if (triggerCode !== null) expect(triggerCode).toBeGreaterThanOrEqual(128);
      } finally {
        if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
        if (browser.exitCode === null && browser.signalCode === null) browser.kill('SIGKILL');
        if (sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill('SIGTERM');
        rmSync(temporaryRoot, { recursive: true, force: true });
      }
    },
  );

  test('cleans up a real child and grandchild while preserving a sentinel', async () => {
    const fixture = spawnManagedProcess(
      process.execPath,
      [
        '-e',
        [
          "const { spawn } = require('node:child_process');",
          "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
          "process.stdout.write(String(grandchild.pid) + '\\n');",
          'setInterval(() => {}, 1000);',
        ].join(' '),
      ],
      { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const managedFixture = manageChildProcess(fixture, 'descendant fixture');
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });

    try {
      const [output] = await once(fixture.stdout!, 'data');
      const grandchildPid = Number(String(output).trim());
      await terminateChildProcess(managedFixture);
      expect(fixture.exitCode === null && fixture.signalCode === null).toBe(false);
      expect(() => process.kill(grandchildPid, 0)).toThrow();
      expect(() => process.kill(sentinel.pid!, 0)).not.toThrow();
    } finally {
      if (fixture.exitCode === null && fixture.signalCode === null) fixture.kill('SIGKILL');
      if (sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill('SIGTERM');
    }
  });

  test('cleans up immediate descendants after the finite build root fails', async () => {
    const failureTrigger =
      process.platform === 'linux'
        ? 'setImmediate(() => process.exit(7));'
        : "process.stdin.once('data', () => process.exit(7));";
    const fixtureArguments = [
      '-e',
      [
        "const { spawn } = require('node:child_process');",
        "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
        "process.stdout.write(String(grandchild.pid) + '\\n');",
        failureTrigger,
      ].join(' '),
    ];
    const fixture =
      process.platform === 'linux'
        ? spawnManagedProcess(process.execPath, fixtureArguments, {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : spawn(process.execPath, fixtureArguments, {
            detached: true,
            stdio: ['pipe', 'pipe', 'ignore'],
          });

    const managedFixture = playgroundBundleDependencyBuildProcess(
      fixture,
      'failed descendant fixture',
      process.platform !== 'win32',
    );
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });
    const [output] = await once(fixture.stdout!, 'data');
    const grandchildPid = Number(String(output).trim());
    if (process.platform !== 'linux') fixture.stdin!.write('fail\n');
    await once(fixture, 'exit');
    await terminateChildProcess(managedFixture);
    await terminateChildProcess(managedFixture);

    expect(() => process.kill(grandchildPid, 0)).toThrow();
    expect(() => process.kill(sentinel.pid!, 0)).not.toThrow();
    sentinel.kill('SIGTERM');
  });

  test('gives finite dependency builds scoped process-group ownership', () => {
    expect(
      playgroundBundleDependencyBuildProcess(
        {} as ChildProcess,
        '@lostgradient/cinder',
        process.platform !== 'win32',
      ),
    ).toMatchObject({
      name: '@lostgradient/cinder build',
    });
    expect(
      playgroundBundleDependencyBuildProcess(
        {} as ChildProcess,
        '@lostgradient/cinder',
        process.platform !== 'win32',
      ).ownedProcessGroupId,
    ).toBeUndefined();
  });

  test('observes a child that exited before exit listeners were attached', async () => {
    const childProcess = spawn(process.execPath, ['-e', 'process.exit(7)']);
    await once(childProcess, 'exit');

    await expect(waitForExit(childProcess)).resolves.toBe(7);
  });

  test('stops starting new managed children after shutdown begins', () => {
    expect(shouldStartManagedChildProcess(null)).toBe(true);
    expect(shouldStartManagedChildProcess(130)).toBe(false);
  });

  test('does not treat a sent kill signal as process exit', () => {
    const stillExiting = { pid: 123, killed: true, exitCode: null, signalCode: null };

    expect(childProcessHasFinished(stillExiting)).toBe(false);
  });

  test('treats exit codes and terminal signals as process exit', () => {
    expect(childProcessHasFinished({ pid: 123, exitCode: 0, signalCode: null })).toBe(true);
    expect(childProcessHasFinished({ pid: 123, exitCode: null, signalCode: 'SIGTERM' })).toBe(true);
  });

  test('treats failed spawns without a process id as finished', () => {
    expect(childProcessHasFinished({ pid: undefined, exitCode: null, signalCode: null })).toBe(
      true,
    );
  });

  test.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('runs the actual cleanup handler for %s', async (signal, exitCode) => {
    const lifecycleModule = fileURLToPath(new URL('./process-lifecycle.ts', import.meta.url));
    const wrapper = spawn(
      process.execPath,
      [
        '-e',
        [
          "import { spawn } from 'node:child_process';",
          `import { cleanupManagedChildren, installSignalCleanupHandlers, manageChildProcess } from ${JSON.stringify(lifecycleModule)};`,
          "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 100000)'], { stdio: 'ignore' });",
          "const managed = manageChildProcess(grandchild, 'signal fixture', false);",
          "process.stdout.write(String(grandchild.pid) + '\\n');",
          'installSignalCleanupHandlers(() => cleanupManagedChildren([managed], null));',
          'setInterval(() => {}, 100000);',
        ].join(' '),
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );

    try {
      const [output] = await once(wrapper.stdout, 'data');
      const grandchildPid = Number(String(output).trim());
      wrapper.kill(signal);
      const [observedCode, observedSignal] = await once(wrapper, 'exit');
      expect(observedCode).toBe(exitCode);
      expect(observedSignal).toBeNull();
      expect(() => process.kill(grandchildPid, 0)).toThrow();
    } finally {
      if (wrapper.exitCode === null && wrapper.signalCode === null) wrapper.kill('SIGKILL');
    }
  });

  test('aggregates sibling cleanup and port-file failures after every attempt', async () => {
    const directory = mkdtempSync(`${tmpdir()}/cinder-cleanup-`);
    const children = await Promise.all(
      [1, 2].map(async () => {
        const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
        await once(child, 'exit');
        return manageChildProcess(child, 'finished fixture', false, () => null);
      }),
    );
    try {
      const error = await cleanupManagedChildren(children, directory).catch((value) => value);
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toHaveLength(3);
      expect(existsSync(directory)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('playwright wrapper exit code', () => {
  test('uses Playwright exit code when no shutdown signal was received', () => {
    expect(finalPlaywrightExitCode(0, null)).toBe(0);
    expect(finalPlaywrightExitCode(1, null)).toBe(1);
  });

  test('prefers shutdown signal exit code over Playwright exit code', () => {
    expect(finalPlaywrightExitCode(0, 130)).toBe(130);
    expect(finalPlaywrightExitCode(1, 143)).toBe(143);
  });

  test('keeps an interrupt exit code when a later failure also requests shutdown', () => {
    expect(shutdownExitCodeAfterRequest(130, 1)).toBe(130);
    expect(shutdownExitCodeAfterRequest(143, 1)).toBe(143);
  });

  test('lets a later interrupt exit code replace an earlier failure exit code', () => {
    expect(shutdownExitCodeAfterRequest(1, 130)).toBe(130);
  });
});

describe('playwright process launch', () => {
  test('runs Playwright through Bun instead of the ambient Node runtime', () => {
    expect(playwrightCommandArguments(['schema-form.playwright.ts', '--workers=1'])).toEqual([
      '--bun',
      'playwright',
      'test',
      'schema-form.playwright.ts',
      '--workers=1',
    ]);
  });

  test('removes NO_COLOR before Playwright forces colors in its workers', () => {
    const environment = { NO_COLOR: '1', PATH: '/bin' };

    expect(playwrightProcessEnvironment(environment)).toEqual({ PATH: '/bin' });
    expect(environment).toEqual({ NO_COLOR: '1', PATH: '/bin' });
  });

  test('preserves unrelated environment variables', () => {
    expect(playwrightProcessEnvironment({ CI: 'true', FORCE_COLOR: '0' })).toEqual({
      CI: 'true',
      FORCE_COLOR: '0',
    });
  });
});

describe('warm playground readiness', () => {
  test('normalizes probe paths against playground URLs with trailing slashes', () => {
    expect(playgroundUrlForPath('/ping', 'http://localhost:5555/')).toBe(
      'http://localhost:5555/ping',
    );
    expect(playgroundUrlForPath('/ready', 'https://example.com/playground/')).toBe(
      'https://example.com/playground/ready',
    );
  });

  test('waits on the warmed-bundle readiness endpoint before Playwright starts', () => {
    expect(playgroundWarmReadinessEndpointPath()).toBe('/ready');
  });

  test('explains stale reused servers that do not expose the readiness endpoint', () => {
    expect(playgroundWarmReadinessMissingEndpointMessage('http://localhost:5555')).toContain(
      'stale playground server',
    );
    expect(playgroundWarmReadinessMissingEndpointMessage('http://localhost:5555')).toContain(
      'stop the stale server before rerunning the test wrapper',
    );
    expect(playgroundWarmReadinessMissingEndpointMessage('http://localhost:5555')).toContain(
      'PLAYWRIGHT_REUSE_SERVER=0',
    );
  });
});

describe('parsePlaygroundFingerprintHeader', () => {
  test('parses a well-formed fingerprint header', () => {
    expect(
      parsePlaygroundFingerprintHeader(
        JSON.stringify({ startedAtMs: 1000, newestSourceMtimeMs: 500 }),
      ),
    ).toEqual({ startedAtMs: 1000, newestSourceMtimeMs: 500 });
  });

  test('accepts a null newestSourceMtimeMs', () => {
    expect(
      parsePlaygroundFingerprintHeader(
        JSON.stringify({ startedAtMs: 1000, newestSourceMtimeMs: null }),
      ),
    ).toEqual({ startedAtMs: 1000, newestSourceMtimeMs: null });
  });

  test('returns null when the header is missing', () => {
    expect(parsePlaygroundFingerprintHeader(null)).toBeNull();
  });

  test('returns null for malformed JSON', () => {
    expect(parsePlaygroundFingerprintHeader('not json')).toBeNull();
  });

  test('returns null when required fields are missing', () => {
    expect(parsePlaygroundFingerprintHeader(JSON.stringify({ startedAtMs: 1000 }))).toBeNull();
  });
});

describe('shouldRefuseStaleServerReuse', () => {
  test('refuses reuse when the running server reports no fingerprint at all', () => {
    // A server started before the fingerprint header existed still responds
    // to /ping and /ready, but never emits the header. Treat that as stale
    // rather than as "nothing to compare, assume fresh" — that is exactly
    // the previous-session server this guard exists to catch.
    expect(shouldRefuseStaleServerReuse(null, 500)).toBe(true);
    expect(shouldRefuseStaleServerReuse(null, null)).toBe(true);
  });

  test('allows reuse when the running server reports a fingerprint at least as new as current source', () => {
    expect(shouldRefuseStaleServerReuse({ startedAtMs: 0, newestSourceMtimeMs: 500 }, 500)).toBe(
      false,
    );
  });

  test('refuses reuse when current source is newer than what the server saw at startup', () => {
    expect(shouldRefuseStaleServerReuse({ startedAtMs: 0, newestSourceMtimeMs: 500 }, 600)).toBe(
      true,
    );
  });
});

describe('stalePlaygroundServerMessage', () => {
  test('names the kill script and the reuse opt-out', () => {
    const message = stalePlaygroundServerMessage('http://localhost:5555');
    expect(message).toContain('kill:playground');
    expect(message).toContain('PLAYWRIGHT_REUSE_SERVER=0');
    expect(message).toContain('stale');
  });
});

describe('installSignalCleanupHandlers', () => {
  test('force-stops a live supervisor after unverified KILL-stage cleanup', () => {
    const signals: NodeJS.Signals[] = [];
    const child = {
      pid: 42,
      exitCode: null,
      signalCode: null,
      kill: (signal: NodeJS.Signals) => {
        signals.push(signal);
        return true;
      },
    };
    forceStopUnverifiedSupervisor(child, 'unverified supervisor');
    expect(signals).toEqual(['SIGKILL']);
  });

  test('shares one cleanup promise across overlapping callers', async () => {
    let calls = 0;
    let resolveCleanup!: () => void;
    const cleanup = createCleanupOnce(
      () =>
        new Promise<void>((resolve) => {
          calls += 1;
          resolveCleanup = resolve;
        }),
    );
    const first = cleanup();
    const second = cleanup();
    expect(calls).toBe(1);
    resolveCleanup();
    await Promise.all([first, second]);
  });

  test('registers exactly one SIGINT and one SIGTERM handler', () => {
    const sigintCountBefore = process.listenerCount('SIGINT');
    const sigtermCountBefore = process.listenerCount('SIGTERM');

    const sigintListenersBefore = process.listeners('SIGINT');
    const sigtermListenersBefore = process.listeners('SIGTERM');

    installSignalCleanupHandlers(async () => {});

    const addedSigint = process
      .listeners('SIGINT')
      .filter((listener) => !sigintListenersBefore.includes(listener));
    const addedSigterm = process
      .listeners('SIGTERM')
      .filter((listener) => !sigtermListenersBefore.includes(listener));

    expect(process.listenerCount('SIGINT')).toBe(sigintCountBefore + 1);
    expect(process.listenerCount('SIGTERM')).toBe(sigtermCountBefore + 1);

    // Clean up so this test does not leak listeners into the rest of the
    // suite (repeated runs would otherwise trip Node's max-listener warning).
    for (const listener of addedSigint) process.off('SIGINT', listener);
    for (const listener of addedSigterm) process.off('SIGTERM', listener);
  });
});
