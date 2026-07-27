import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { getPackFileName } from './publish-release.ts';
import { packageTarballPath } from './report-package-weight.ts';
import {
  bumpPackageVersion,
  chatPeerValidationTarballPath,
  EXAMPLES_CONSUMER_READINESS_PATH,
  resolveChatFixtureCinderVersion,
  runBoundedHydrationTeardown,
} from './validate-consumers.ts';

describe('hydration teardown', () => {
  test('forces later resources closed when page close never settles', async () => {
    const calls: string[] = [];
    const failures = await runBoundedHydrationTeardown(
      [
        {
          phase: 'page.close',
          close: () => new Promise<void>(() => {}),
          forceClose: () => {
            calls.push('page.forceClose');
          },
          state: () => 'pageClosed=false',
        },
        {
          phase: 'browser.close',
          close: async () => {
            calls.push('browser.close');
          },
          state: () => 'browserConnected=false',
        },
        {
          phase: 'fixture-server.exited',
          close: async () => {
            calls.push('fixture-server.exited');
          },
          state: () => 'fixtureServerExitCode=0',
        },
      ],
      1,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]?.phase).toBe('page.close');
    expect(failures[0]?.state).toBe('pageClosed=false');
    expect(calls).toEqual(['page.forceClose', 'browser.close', 'fixture-server.exited']);
  });
});

describe('examples consumer readiness', () => {
  test('polls a static build asset instead of repeatedly rendering every example', () => {
    expect(EXAMPLES_CONSUMER_READINESS_PATH).toBe('/_app/version.json');
    expect(EXAMPLES_CONSUMER_READINESS_PATH).not.toBe('/');
  });
});

describe('Chat peer-compatible Cinder fixture artifact', () => {
  test('uses the exact publish artifact once Cinder satisfies the Chat peer', () => {
    expect(
      resolveChatFixtureCinderVersion({
        currentVersion: '0.16.0',
        peerRange: '^0.16.0',
        pendingReleaseType: 'minor',
      }),
    ).toEqual({ version: '0.16.0', requiresValidationOnlyRepack: false });
  });

  test('stages only the pending minor version before the Version Packages pull request', () => {
    expect(
      resolveChatFixtureCinderVersion({
        currentVersion: '0.15.0',
        peerRange: '^0.16.0',
        pendingReleaseType: 'minor',
      }),
    ).toEqual({ version: '0.16.0', requiresValidationOnlyRepack: true });
  });

  test('keeps the canonical tarball filename below a fixture-only directory', () => {
    const packageRoot = '/workspace/packages/components';
    const identity = {
      name: '@lostgradient/cinder',
      version: '0.16.0',
    };
    const validationPath = chatPeerValidationTarballPath(packageRoot, identity);
    const publishPath = join(packageRoot, getPackFileName(identity));

    expect(validationPath).toBe(
      '/workspace/packages/components/tmp/chat-peer-validation/lostgradient-cinder-0.16.0.tgz',
    );
    expect(packageTarballPath(packageRoot, identity)).toBe(publishPath);
    expect(validationPath).not.toBe(publishPath);
  });

  test('rejects an incompatible pair without an exact pending changeset bridge', () => {
    expect(() =>
      resolveChatFixtureCinderVersion({
        currentVersion: '0.15.0',
        peerRange: '^0.16.0',
      }),
    ).toThrow('no pending Cinder changeset');
    expect(() =>
      resolveChatFixtureCinderVersion({
        currentVersion: '0.15.0',
        peerRange: '^0.16.0',
        pendingReleaseType: 'patch',
      }),
    ).toThrow('pending Cinder 0.15.1 does not satisfy');
  });

  test('applies plain semantic-version bumps deterministically', () => {
    expect(bumpPackageVersion('0.15.0', 'patch')).toBe('0.15.1');
    expect(bumpPackageVersion('0.15.0', 'minor')).toBe('0.16.0');
    expect(bumpPackageVersion('0.15.0', 'major')).toBe('1.0.0');
  });
});
