import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dockerBrowserCommand,
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

  it('quotes forwarded browser-test arguments for the container shell', () => {
    expect(dockerBrowserCommand(['--grep', 'Button > dark desktop'])).toBe(
      "cd /work && git config --global --add safe.directory /work && bun install --frozen-lockfile && bun run test:browser -- '--grep' 'Button > dark desktop'",
    );
  });

  it('passes browser environment into the container', () => {
    expect(
      dockerRunArguments({
        repoRoot: '/repo',
        imageTag: 'cinder-playwright:1.60.0',
        containerCommand:
          'cd /work && git config --global --add safe.directory /work && bun run test:browser:update',
        environment: {
          CI: 'true',
          CINDER_TEST_COMPONENTS: 'button',
          CINDER_VISUAL_DIFF: 'block',
          PLAYWRIGHT_TRACE: 'off',
          PLAYGROUND_URL: '',
        },
      }),
    ).toEqual([
      'run',
      '--rm',
      '-e',
      'CI=true',
      '-e',
      'CINDER_TEST_COMPONENTS=button',
      '-e',
      'CINDER_VISUAL_DIFF=block',
      '-e',
      'PLAYWRIGHT_TRACE=off',
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
