import { describe, expect, test } from 'bun:test';

import {
  appendServerOutputBuffer,
  localPlaygroundUrlForReportedPort,
  parsePlaygroundListeningPort,
  playgroundBundleDependencyBuildArguments,
  playgroundBundleDependencyBuildPackages,
  playgroundWarmReadinessEndpointPath,
  playgroundWarmReadinessMissingEndpointMessage,
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
  test('builds every private package the playground browser bundle resolves through dist', () => {
    expect(playgroundBundleDependencyBuildPackages()).toEqual([
      '@cinder/diff',
      '@cinder/markdown',
      '@cinder/editor',
      '@cinder/commentary',
    ]);
  });

  test('build arguments use Bun workspace filters', () => {
    expect(playgroundBundleDependencyBuildArguments('@cinder/markdown')).toEqual([
      'run',
      '--filter=@cinder/markdown',
      'build',
    ]);
  });
});

describe('warm playground readiness', () => {
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
