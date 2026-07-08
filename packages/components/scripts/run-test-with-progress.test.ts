import { describe, expect, it } from 'bun:test';

import {
  buildBunTestArguments,
  formatExitMessage,
  formatHeartbeatMessage,
  formatProgressCommand,
  runTestWithProgress,
  type ProgressRunnerDependencies,
} from './run-test-with-progress.ts';

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('buildBunTestArguments', () => {
  it('preserves the serial browser and svelte test flags before forwarded arguments', () => {
    expect(buildBunTestArguments(['--coverage', '--coverage-reporter=lcov'])).toEqual([
      'test',
      '--conditions',
      'browser',
      '--conditions',
      'svelte',
      '--parallel=1',
      '--coverage',
      '--coverage-reporter=lcov',
    ]);
  });
});

describe('test progress formatting', () => {
  it('formats the command and quotes unsafe arguments', () => {
    expect(formatProgressCommand('bun', ['test', '--name', 'chat input'])).toBe(
      "bun test --name 'chat input'",
    );
  });

  it('formats heartbeat and exit lines with elapsed seconds', () => {
    expect(formatHeartbeatMessage('bun test', 1_000, 31_500)).toBe(
      '[test-progress] bun test still running after 30s\n',
    );
    expect(formatExitMessage('bun test', 1_000, 61_000, 143)).toBe(
      '[test-progress] bun test failed with exit 143 after 60s\n',
    );
  });
});

describe('runTestWithProgress', () => {
  it('emits start, heartbeat, and completion messages while preserving child exit code', async () => {
    const childExit = deferred<number>();
    const messages: string[] = [];
    const intervals: Array<() => void> = [];
    let now = 10_000;
    let spawnedCommand: readonly string[] = [];

    const dependencies: ProgressRunnerDependencies = {
      clearInterval: () => {
        intervals.length = 0;
      },
      now: () => now,
      setInterval: (callback) => {
        intervals.push(callback);
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      spawn: ((command: string[]) => {
        spawnedCommand = command;
        return {
          exited: childExit.promise,
          pid: 12345,
        };
      }) as ProgressRunnerDependencies['spawn'],
      write: (message) => messages.push(message),
    };

    const resultPromise = runTestWithProgress(
      {
        forwardedArguments: ['--coverage'],
        heartbeatMilliseconds: 1,
      },
      dependencies,
    );

    expect(spawnedCommand).toEqual([
      'bun',
      'test',
      '--conditions',
      'browser',
      '--conditions',
      'svelte',
      '--parallel=1',
      '--coverage',
    ]);

    now = 40_250;
    intervals[0]?.();
    childExit.resolve(7);

    expect(await resultPromise).toBe(7);
    expect(messages).toEqual([
      '[test-progress] starting bun test --conditions browser --conditions svelte --parallel=1 --coverage\n',
      '[test-progress] bun test --conditions browser --conditions svelte --parallel=1 --coverage still running after 30s\n',
      '[test-progress] bun test --conditions browser --conditions svelte --parallel=1 --coverage failed with exit 7 after 30s\n',
    ]);
    expect(intervals).toEqual([]);
  });
});
