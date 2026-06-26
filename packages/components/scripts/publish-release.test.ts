import { describe, expect, mock, test } from 'bun:test';

import { resolvePublishAction, runPublishRelease } from './publish-release.ts';

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
  });

  test('publishes when the package version is not present on npm', () => {
    expect(resolvePublishAction({ dryRun: false, versionExists: false })).toBe('publish');
    expect(resolvePublishAction({ dryRun: true, versionExists: false })).toBe('publish');
  });

  test('skips the dry-run publish command when the package version already exists', async () => {
    const output: string[] = [];
    const spawnPublish = mock((_publishArguments: string[]) => ({ exitCode: 0 }));
    const validateConsumerArtifact = mock(async () => {});

    await runPublishRelease({
      dryRun: true,
      skipValidation: true,
      packageRootPath: '/tmp/cinder-package',
      dependencies: {
        readManifest: async () => ({ name: '@lostgradient/cinder', version: '9.9.9' }),
        versionExists: async () => true,
        artifactExists: () => true,
        validateConsumerArtifact,
        spawnPublish,
        writeOutput: (message) => {
          output.push(message);
        },
      },
    });

    expect(validateConsumerArtifact).not.toHaveBeenCalled();
    expect(spawnPublish).not.toHaveBeenCalled();
    expect(output.join('')).toContain(
      '@lostgradient/cinder@9.9.9 already exists on npm; nothing to publish',
    );
  });

  test('rebuilds the consumer artifact before a dry-run publish when skip-validation has no tarball', async () => {
    const output: string[] = [];
    let artifactReady = false;
    const spawnPublish = mock((_publishArguments: string[]) => ({ exitCode: 0 }));
    const validateConsumerArtifact = mock(async () => {
      artifactReady = true;
    });

    await runPublishRelease({
      dryRun: true,
      skipValidation: true,
      packageRootPath: '/tmp/cinder-package',
      dependencies: {
        readManifest: async () => ({ name: '@lostgradient/cinder', version: '9.9.9' }),
        versionExists: async () => false,
        artifactExists: () => artifactReady,
        validateConsumerArtifact,
        spawnPublish,
        writeOutput: (message) => {
          output.push(message);
        },
      },
    });

    expect(validateConsumerArtifact).toHaveBeenCalledTimes(1);
    expect(spawnPublish).toHaveBeenCalledWith([
      'publish',
      '/tmp/cinder-package/lostgradient-cinder-9.9.9.tgz',
      '--dry-run',
    ]);
    expect(output.join('')).toContain('no validated artifact found');
  });
});
