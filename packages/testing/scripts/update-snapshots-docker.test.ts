import { describe, expect, it } from 'bun:test';

import {
  dockerImageTagForVersion,
  dockerRunArguments,
  dockerUpdateCommand,
} from './update-snapshots-docker.ts';

describe('update-snapshots-docker helpers', () => {
  it('derives the Docker image tag from the pinned Playwright version', () => {
    expect(dockerImageTagForVersion('1.60.0')).toBe('cinder-playwright:1.60.0');
  });

  it('quotes forwarded update arguments for the container shell', () => {
    expect(dockerUpdateCommand(['--grep', 'Button > dark desktop'])).toBe(
      "cd /work && bun install --frozen-lockfile && bun run --filter=@cinder/testing test:browser:update -- '--grep' 'Button > dark desktop'",
    );
  });

  it('passes the scoped component list into the container', () => {
    expect(
      dockerRunArguments({
        repoRoot: '/repo',
        imageTag: 'cinder-playwright:1.60.0',
        updateCommand: 'cd /work && bun run test:browser:update',
        componentScope: 'button',
      }),
    ).toEqual([
      'run',
      '--rm',
      '-e',
      'CINDER_TEST_COMPONENTS=button',
      '-v',
      '/repo:/work',
      '-w',
      '/work',
      'cinder-playwright:1.60.0',
      'cd /work && bun run test:browser:update',
    ]);
  });
});
