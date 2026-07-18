import { describe, expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import {
  appendServerOutputBuffer,
  childProcessHasFinished,
  finalPlaywrightExitCode,
  installSignalCleanupHandlers,
  localPlaygroundUrlForReportedPort,
  parsePlaygroundFingerprintHeader,
  parsePlaygroundListeningPort,
  playgroundBundleDependencyBuildArguments,
  playgroundBundleDependencyBuildPackages,
  playgroundBundleDependencyBuildProcess,
  playgroundServerArguments,
  playgroundServerWorkingDirectory,
  playgroundUrlForPath,
  playgroundWarmReadinessEndpointPath,
  playgroundWarmReadinessMissingEndpointMessage,
  shouldRefuseStaleServerReuse,
  shouldStartManagedChildProcess,
  shutdownExitCodeAfterRequest,
  stalePlaygroundServerMessage,
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
  test('builds every workspace package the playground browser bundle resolves through dist', () => {
    expect(playgroundBundleDependencyBuildPackages()).toEqual([
      '@cinder/diff',
      '@cinder/markdown',
      '@cinder/editor',
      '@cinder/commentary',
      '@lostgradient/cinder',
      '@lostgradient/chat',
    ]);
  });

  test('build arguments use Bun workspace filters', () => {
    expect(playgroundBundleDependencyBuildArguments('@cinder/markdown')).toEqual([
      'run',
      '--filter=@cinder/markdown',
      'build',
    ]);
  });

  test('registers dependency builds as managed child processes', () => {
    const childProcess = {} as ChildProcess;
    const managedChildProcess = playgroundBundleDependencyBuildProcess(
      childProcess,
      '@cinder/markdown',
    );

    expect(managedChildProcess.childProcess).toBe(childProcess);
    expect(managedChildProcess.name).toBe('@cinder/markdown build');
    expect(managedChildProcess.killProcessGroup).toBe(process.platform !== 'win32');
  });
});

describe('playground server process', () => {
  test('starts the plain server entrypoint instead of the watch-mode dev script', () => {
    const argumentsList = playgroundServerArguments();

    expect(argumentsList).toEqual(['run', 'src/playground-server.ts']);
    expect(argumentsList).not.toContain('dev');
    expect(argumentsList).not.toContain('--watch');
    expect(playgroundServerWorkingDirectory().endsWith(join('packages', 'playground'))).toBe(true);
  });
});

describe('child process cleanup', () => {
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
