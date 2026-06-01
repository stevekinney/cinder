import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dockerImageTagForVersion,
  dockerRunArguments,
  dockerUpdateCommand,
} from './update-snapshots-docker.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dockerfilePath = resolvePath(here, '..', 'Dockerfile');

describe('update-snapshots-docker helpers', () => {
  it('derives the Docker image tag from the pinned Playwright version', () => {
    expect(dockerImageTagForVersion('1.60.0')).toBe('cinder-playwright:1.60.0');
  });

  it('quotes forwarded update arguments for the container shell', () => {
    expect(dockerUpdateCommand(['--grep', 'Button > dark desktop'])).toBe(
      "cd /work && git config --global --add safe.directory /work && bun install --frozen-lockfile && bun run --filter=@cinder/testing test:browser:update -- '--grep' 'Button > dark desktop'",
    );
  });

  it('passes the scoped component list into the container', () => {
    expect(
      dockerRunArguments({
        repoRoot: '/repo',
        imageTag: 'cinder-playwright:1.60.0',
        updateCommand:
          'cd /work && git config --global --add safe.directory /work && bun run test:browser:update',
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
      'cd /work && git config --global --add safe.directory /work && bun run test:browser:update',
    ]);
  });

  it('exposes bunx in the canonical Docker image', () => {
    expect(readFileSync(dockerfilePath, 'utf8')).toContain(
      'ln -sf /root/.bun/bin/bun /usr/local/bin/bunx',
    );
  });
});
