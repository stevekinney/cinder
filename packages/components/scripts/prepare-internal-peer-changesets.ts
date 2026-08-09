import parseChangeset from '@changesets/parse';
import { Glob } from 'bun';
import { join } from 'node:path';

import { isPreRelease } from './check-changeset-prerelease-bumps.ts';

const INTERNAL_DEPENDENCY_NAMES = new Set(['@lostgradient/cinder', '@lostgradient/markdown']);
const RELEASE_TYPE_PRIORITY = { patch: 0, minor: 1, major: 2 } as const;

type ReleaseType = keyof typeof RELEASE_TYPE_PRIORITY;

export const SYNTHETIC_CHANGESET_FILENAME = 'reconcile-internal-peers.md';

export type InternalPeerDependent = {
  name: string;
  manifestPath: string;
};

export type PrepareInternalPeerChangesetsOptions = {
  changesetDirectory: string;
  dependents: InternalPeerDependent[];
};

export type PrepareInternalPeerChangesetsResult = {
  writtenReleases: string[];
};

/** Return the smallest dependent bump allowed for a peer-range narrowing. */
export function requiredInternalPeerReconciliationBump(
  dependentVersion: string,
): 'minor' | 'major' {
  return isPreRelease(dependentVersion) ? 'minor' : 'major';
}

export function syntheticChangesetContent(
  releases: Array<{ name: string; releaseType: 'minor' | 'major' }>,
): string {
  const frontmatter = releases
    .map(({ name, releaseType }) => `'${name}': ${releaseType}`)
    .join('\n');
  return `---\n${frontmatter}\n---\n\nWiden internal peer ranges to follow the coordinated release.\n`;
}

async function readPackageVersion(manifestPath: string, packageName: string): Promise<string> {
  const manifest: unknown = await Bun.file(manifestPath).json();
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string' ||
    manifest.version.length === 0
  ) {
    throw new Error(
      `${packageName} manifest at ${manifestPath} must define a non-empty string version.`,
    );
  }
  return manifest.version;
}

/** Add dependent changesets when pending internal releases will narrow their peer ranges. */
export async function prepareInternalPeerChangesets(
  options: PrepareInternalPeerChangesetsOptions,
): Promise<PrepareInternalPeerChangesetsResult> {
  let dependencyMinorOrMajorPending = false;
  const highestDependentReleaseTypes = new Map<string, ReleaseType>();
  const dependentNames = new Set(options.dependents.map(({ name }) => name));
  const changesetGlob = new Glob('*.md');

  for await (const relativePath of changesetGlob.scan({ cwd: options.changesetDirectory })) {
    if (relativePath === 'README.md') continue;

    const source = await Bun.file(join(options.changesetDirectory, relativePath)).text();
    for (const release of parseChangeset(source).releases) {
      if (
        dependentNames.has(release.name) &&
        (release.type === 'patch' || release.type === 'minor' || release.type === 'major')
      ) {
        const releaseType = release.type;
        const highestReleaseType = highestDependentReleaseTypes.get(release.name);
        if (
          highestReleaseType === undefined ||
          RELEASE_TYPE_PRIORITY[releaseType] > RELEASE_TYPE_PRIORITY[highestReleaseType]
        ) {
          highestDependentReleaseTypes.set(release.name, releaseType);
        }
      }
      if (
        INTERNAL_DEPENDENCY_NAMES.has(release.name) &&
        (release.type === 'minor' || release.type === 'major')
      ) {
        dependencyMinorOrMajorPending = true;
      }
    }
  }

  if (!dependencyMinorOrMajorPending) return { writtenReleases: [] };

  const missingReleases: Array<{ name: string; releaseType: 'minor' | 'major' }> = [];
  for (const dependent of options.dependents) {
    const requiredBump = requiredInternalPeerReconciliationBump(
      await readPackageVersion(dependent.manifestPath, dependent.name),
    );
    const highestReleaseType = highestDependentReleaseTypes.get(dependent.name);
    if (
      highestReleaseType === undefined ||
      RELEASE_TYPE_PRIORITY[highestReleaseType] < RELEASE_TYPE_PRIORITY[requiredBump]
    ) {
      missingReleases.push({ name: dependent.name, releaseType: requiredBump });
    }
  }

  if (missingReleases.length === 0) return { writtenReleases: [] };

  const syntheticChangesetPath = join(options.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME);
  if (await Bun.file(syntheticChangesetPath).exists()) return { writtenReleases: [] };

  await Bun.write(syntheticChangesetPath, syntheticChangesetContent(missingReleases));
  return { writtenReleases: missingReleases.map(({ name }) => name) };
}

async function main(): Promise<void> {
  const workspaceRoot = join(import.meta.dir, '..', '..', '..');
  const result = await prepareInternalPeerChangesets({
    changesetDirectory: join(workspaceRoot, '.changeset'),
    dependents: [
      {
        name: '@lostgradient/chat',
        manifestPath: join(workspaceRoot, 'packages', 'chat', 'package.json'),
      },
      {
        name: '@lostgradient/editor',
        manifestPath: join(workspaceRoot, 'packages', 'editor', 'package.json'),
      },
    ],
  });

  if (result.writtenReleases.length > 0) {
    console.log(
      `prepare-internal-peer-changesets — wrote .changeset/${SYNTHETIC_CHANGESET_FILENAME} for ${result.writtenReleases.join(', ')}`,
    );
  } else {
    console.log('prepare-internal-peer-changesets — no change');
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      `prepare-internal-peer-changesets failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
