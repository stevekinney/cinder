import { describe, expect, mock, test } from 'bun:test';

import {
  getPackFileName,
  resolvePackageRootArgument,
  resolvePublishAction,
  runPublishRelease,
} from './publish-release.ts';

describe('publish-release package selection', () => {
  test('derives scoped tarball names for either public package', () => {
    expect(getPackFileName({ name: '@lostgradient/cinder', version: '0.16.0' })).toBe(
      'lostgradient-cinder-0.16.0.tgz',
    );
    expect(getPackFileName({ name: '@lostgradient/chat', version: '0.1.0' })).toBe(
      'lostgradient-chat-0.1.0.tgz',
    );
  });

  test('resolves explicit package roots relative to the invoking package', () => {
    expect(
      resolvePackageRootArgument(['--package-root', '.'], {
        defaultRoot: '/workspace/packages/components',
        currentWorkingDirectory: '/workspace/packages/chat',
      }),
    ).toBe('/workspace/packages/chat');
    expect(
      resolvePackageRootArgument(['--package-root=../chat'], {
        defaultRoot: '/workspace/packages/components',
        currentWorkingDirectory: '/workspace/packages/components',
      }),
    ).toBe('/workspace/packages/chat');
  });

  test('uses the components root by default and rejects missing values', () => {
    expect(
      resolvePackageRootArgument([], {
        defaultRoot: '/workspace/packages/components',
        currentWorkingDirectory: '/workspace',
      }),
    ).toBe('/workspace/packages/components');
    expect(() =>
      resolvePackageRootArgument(['--package-root'], {
        defaultRoot: '/workspace/packages/components',
        currentWorkingDirectory: '/workspace',
      }),
    ).toThrow('--package-root requires a path argument');
  });
});

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

  test('publishes only the tarball matching the source manifest version', async () => {
    const publishedArguments: string[][] = [];
    await runPublishRelease({
      dryRun: false,
      skipValidation: true,
      packageRootPath: '/tmp/cinder-package',
      dependencies: {
        readManifest: async () => ({ name: '@lostgradient/cinder', version: '0.15.0' }),
        versionExists: async () => false,
        // A validation-only 0.16.0 peer fixture could exist beside this file;
        // publish-release must derive and select only the manifest's 0.15.0 artifact.
        artifactExists: (path) => path.endsWith('lostgradient-cinder-0.15.0.tgz'),
        validateConsumerArtifact: async () => {},
        spawnPublish: (arguments_) => {
          publishedArguments.push(arguments_);
          return { exitCode: 0 };
        },
        writeOutput: () => {},
      },
    });

    expect(publishedArguments).toEqual([
      ['publish', '/tmp/cinder-package/lostgradient-cinder-0.15.0.tgz'],
    ]);
  });
});
