import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { getPackFileName } from './publish-release.ts';
import { packageTarballPath } from './report-package-weight.ts';
import {
  bumpPackageVersion,
  chatPeerValidationTarballPath,
  EXAMPLES_CONSUMER_READINESS_PATH,
  resolveChatFixtureCinderVersion,
} from './validate-consumers.ts';

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
