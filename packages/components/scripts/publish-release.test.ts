import { describe, expect, test } from 'bun:test';

import { existingVersionMessage, resolvePublishAction } from './publish-release.ts';

describe('publish-release existing-version handling', () => {
  test('skips publish when the package version already exists', () => {
    expect(resolvePublishAction({ dryRun: false, versionExists: true })).toBe(
      'skip-existing-version',
    );
  });

  test('skips dry-run publish when the package version already exists', () => {
    expect(resolvePublishAction({ dryRun: true, versionExists: true })).toBe(
      'skip-existing-version',
    );
    expect(
      existingVersionMessage({ name: '@lostgradient/cinder', version: '0.3.0' }, true),
    ).toContain('skipping dry-run publish');
  });

  test('publishes when the package version is not present on npm', () => {
    expect(resolvePublishAction({ dryRun: false, versionExists: false })).toBe('publish');
    expect(resolvePublishAction({ dryRun: true, versionExists: false })).toBe('publish');
  });
});
