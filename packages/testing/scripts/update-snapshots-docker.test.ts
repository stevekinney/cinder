import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve as resolvePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dockerBrowserEnvironment } from './run-browser-docker.ts';
import {
  CONTAINER_WRITTEN_PATHS,
  dockerBrowserCommand,
  dockerImageTagForVersion,
  dockerRunArguments,
  dockerUpdateCommand,
  gitMetadataEnvironment,
  gitMetadataMountPaths,
  hostOwnershipEnvironment,
  ownershipReclaimSuffix,
} from './update-snapshots-docker.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dockerfilePath = resolvePath(here, '..', 'Dockerfile');

const RECLAIM_TAIL =
  '; status=$?' +
  '; chown -R "$CINDER_HOST_UID:$CINDER_HOST_GID"' +
  ' packages/testing/test-results packages/testing/screenshots' +
  ' packages/testing/playwright-report packages/testing/.playwright' +
  ' 2>/dev/null || true' +
  '; exit $status';

function isInsideDirectory(path: string, directory: string): boolean {
  const pathFromDirectory = relative(directory, path);
  return (
    pathFromDirectory.length === 0 ||
    (!pathFromDirectory.startsWith(`..${sep}`) &&
      pathFromDirectory !== '..' &&
      !isAbsolute(pathFromDirectory))
  );
}

describe('update-snapshots-docker helpers', () => {
  it('derives the Docker image tag from the pinned Playwright version', () => {
    expect(dockerImageTagForVersion('1.60.0')).toBe('cinder-playwright:1.60.0');
  });

  it('quotes forwarded update arguments and reclaims ownership for the container shell', () => {
    expect(dockerUpdateCommand(['--grep', 'Button > dark desktop'])).toBe(
      "cd /work && git config --global --add safe.directory /work && bun install --frozen-lockfile && bun run --filter=@cinder/testing test:browser:update -- '--grep' 'Button > dark desktop'" +
        RECLAIM_TAIL,
    );
  });

  it('quotes forwarded browser-test arguments and reclaims ownership for the container shell', () => {
    expect(dockerBrowserCommand(['--grep', 'Button > dark desktop'])).toBe(
      "cd /work && git config --global --add safe.directory /work && bun install --frozen-lockfile && bun run test:browser -- '--grep' 'Button > dark desktop'" +
        RECLAIM_TAIL,
    );
  });
});

describe('Git metadata mounts', () => {
  it('maps external Git metadata to Linux paths on Windows', () => {
    const mounts = [
      {
        hostPath: 'C:\\repositories\\cinder\\.git\\worktrees\\review',
        containerPath: '/git-metadata/0',
      },
      { hostPath: 'C:\\repositories\\cinder\\.git', containerPath: '/git-metadata/1' },
    ];

    expect(gitMetadataEnvironment(mounts, 'win32')).toEqual({
      GIT_DIR: '/git-metadata/0',
      GIT_COMMON_DIR: '/git-metadata/1',
    });
    expect(
      dockerRunArguments({
        repoRoot: 'C:\\worktrees\\cinder',
        imageTag: 'cinder-playwright:1.60.0',
        containerCommand: 'noop',
        gitMetadataMounts: mounts,
      }),
    ).toContain('C:\\repositories\\cinder\\.git\\worktrees\\review:/git-metadata/0:ro');
  });

  it('includes metadata mounts supplied by the Docker wrapper', () => {
    // Exercise the pure Docker argument behavior; the Git-backed helper
    // is covered by the actual canonical Docker baseline command below.
    const args = dockerRunArguments({
      repoRoot: '/repo',
      imageTag: 'cinder-playwright:1.60.0',
      containerCommand: 'noop',
      gitMetadataMountPaths: ['/repo/.git'],
    });
    expect(args).toContain('/repo/.git:/repo/.git:ro');
  });

  it('mounts linked-worktree metadata read-only at the path Git recorded', () => {
    const args = dockerRunArguments({
      repoRoot: '/worktrees/cinder',
      imageTag: 'cinder-playwright:1.60.0',
      containerCommand: 'noop',
      gitMetadataMountPaths: [
        '/repositories/cinder/.git/worktrees/cinder17',
        '/repositories/cinder/.git',
      ],
    });
    expect(args).toContain(
      '/repositories/cinder/.git/worktrees/cinder17:/repositories/cinder/.git/worktrees/cinder17:ro',
    );
    expect(args).toContain('/repositories/cinder/.git:/repositories/cinder/.git:ro');
  });

  it('discovers the current checkout metadata without mounting its parent checkout', () => {
    const repositoryRoot = resolvePath(here, '../../..');
    const paths = gitMetadataMountPaths(repositoryRoot);
    expect(paths.every((path) => !isInsideDirectory(path, repositoryRoot))).toBe(true);
  });
});

describe('container ownership reclaim', () => {
  it('pins the exact tail shape so the suite exit status is never swallowed', () => {
    expect(ownershipReclaimSuffix()).toBe(RECLAIM_TAIL);
  });

  it('captures the suite status before running chown and re-exits it verbatim', () => {
    const tail = ownershipReclaimSuffix();
    // The ENTRYPOINT is `bash -lc` with no `-e`. If `status=$?` moved after the
    // chown, or the trailing `exit $status` were dropped, a red suite would
    // report green. Both positions are load-bearing.
    expect(tail.indexOf('status=$?')).toBeLessThan(tail.indexOf('chown'));
    expect(tail.endsWith('; exit $status')).toBe(true);
    // `|| true` must only guard chown, never the suite itself.
    expect(tail.indexOf('|| true')).toBeGreaterThan(tail.indexOf('chown'));
    expect(tail.indexOf('|| true')).toBeLessThan(tail.indexOf('exit $status'));
  });

  it('reclaims every path the container writes through the bind mount', () => {
    expect([...CONTAINER_WRITTEN_PATHS]).toEqual([
      'packages/testing/test-results',
      'packages/testing/screenshots',
      'packages/testing/playwright-report',
      'packages/testing/.playwright',
    ]);
    for (const path of CONTAINER_WRITTEN_PATHS) {
      expect(ownershipReclaimSuffix()).toContain(` ${path}`);
    }
  });

  it('exposes the computed host uid/gid as container environment variables', () => {
    expect(
      hostOwnershipEnvironment({
        getuid: () => 501,
        getgid: () => 20,
      } as unknown as typeof process),
    ).toEqual({ CINDER_HOST_UID: '501', CINDER_HOST_GID: '20' });
  });

  it('omits the uid/gid on platforms without process.getuid', () => {
    expect(hostOwnershipEnvironment({} as unknown as typeof process)).toEqual({});
  });

  it('merges the host uid/gid into the forwarded browser environment', () => {
    expect(
      dockerBrowserEnvironment({ CI: 'true' } as NodeJS.ProcessEnv, {
        CINDER_HOST_UID: '501',
        CINDER_HOST_GID: '20',
      }),
    ).toMatchObject({
      CI: 'true',
      CINDER_HOST_UID: '501',
      CINDER_HOST_GID: '20',
    });
  });

  it('emits no uid/gid run arguments when the platform omits them', () => {
    const args = dockerRunArguments({
      repoRoot: '/repo',
      imageTag: 'cinder-playwright:1.60.0',
      containerCommand: 'noop',
      environment: dockerBrowserEnvironment({} as NodeJS.ProcessEnv, {}),
    });
    expect(args.join(' ')).not.toContain('CINDER_HOST_UID');
    expect(args.join(' ')).not.toContain('CINDER_HOST_GID');
  });
});

describe('update-snapshots-docker helpers (continued)', () => {
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
          CINDER_TEST_SHARD: '3/8',
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
      'CINDER_TEST_SHARD=3/8',
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
