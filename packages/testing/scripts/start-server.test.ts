import { describe, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  childProcessHasFinished,
  cleanupManagedChildren,
  descendantProcessIds,
  installSignalCleanupHandlers,
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
    expect(managedChildProcess.killProcessGroup).toBe(process.platform !== 'win32');
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
      const server = spawn(
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
        { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const browser = spawn(
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
        { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        detached: process.platform !== 'win32',
        stdio: 'ignore',
      });
      const managedServer = playgroundBundleDependencyBuildProcess(
        server,
        'lifecycle server',
        false,
        process.platform !== 'win32',
      );
      const managedBrowser = playgroundBundleDependencyBuildProcess(
        browser,
        'lifecycle browser',
        false,
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
        expect(await (await fetch(`http://127.0.0.1:${serverDetails.port}`)).text()).toBe('ok');
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

  test('cleans up a real child and grandchild when process-group cleanup is disabled', async () => {
    const fixture = spawn(
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
      { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'ignore'] },
    );

    try {
      await once(fixture.stdout!, 'data');
      await terminateChildProcess({
        childProcess: fixture,
        name: 'descendant fixture',
        killProcessGroup: false,
      });
      expect(fixture.exitCode === null && fixture.signalCode === null).toBe(false);
    } finally {
      if (fixture.exitCode === null && fixture.signalCode === null) fixture.kill('SIGKILL');
    }
  });

  test('cleans up immediate descendants after the finite build root fails', async () => {
    const fixture = spawn(
      process.execPath,
      [
        '-e',
        [
          "const { spawn } = require('node:child_process');",
          "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
          "process.stdout.write(String(grandchild.pid) + '\\n');",
          'process.exit(7);',
        ].join(' '),
      ],
      { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'ignore'] },
    );

    const managedFixture = playgroundBundleDependencyBuildProcess(
      fixture,
      'failed descendant fixture',
      process.platform !== 'win32',
      process.platform !== 'win32',
    );
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });
    const [output] = await once(fixture.stdout!, 'data');
    const grandchildPid = Number(String(output).trim());
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
        process.platform !== 'win32',
      ),
    ).toMatchObject({
      name: '@lostgradient/cinder build',
      killProcessGroup: process.platform !== 'win32',
    });
    expect(
      playgroundBundleDependencyBuildProcess(
        {} as ChildProcess,
        '@lostgradient/cinder',
        process.platform !== 'win32',
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
          "const managed = manageChildProcess(grandchild, 'signal fixture', false, false);",
          "process.stdout.write(String(grandchild.pid) + '\\n');",
          'installSignalCleanupHandlers(() => cleanupManagedChildren([managed], null));',
          'setInterval(() => {}, 100000);',
        ].join(' '),
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );

    try {
      const [output] = await once(wrapper.stdout!, 'data');
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
