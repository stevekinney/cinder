import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  loadFixtureFile as loadStaticFixtureFile,
  resolveFixtureFilePath as resolveStaticFixtureFilePath,
  type FixtureFileEntry,
} from '../../extract-fixtures.ts';
import {
  fixtureRenderMode,
  type InteractionStep,
  type MaskRule,
  type VisualFixture,
} from './schema.ts';

const DEFAULT_COMPONENTS_ROOT = resolve(import.meta.dirname, '..', '..', '..', 'src', 'components');

export type FixtureManifestEntry = {
  name: string;
  mode: 'direct' | 'host';
  fixtureContentHash: string;
  interact?: InteractionStep[];
  mask?: MaskRule[];
  category: VisualFixture['category'];
};

export type LoadedFixtureFile = FixtureFileEntry;

export function resolveFixtureFilePath(
  slug: string,
  componentsRoot: string = DEFAULT_COMPONENTS_ROOT,
): string {
  return resolveStaticFixtureFilePath(slug, componentsRoot);
}

export async function loadFixtureFile(sourcePath: string): Promise<LoadedFixtureFile | null> {
  const file = Bun.file(sourcePath);
  if (!(await file.exists())) return null;

  const result = await loadStaticFixtureFile(sourcePath);
  if (result.kind === 'skipped') return null;
  if (result.kind === 'violations') {
    throw new Error(result.violations.join('\n'));
  }
  return result.entry;
}

export function normalizeFixtureMetadata(entry: LoadedFixtureFile): FixtureManifestEntry[] {
  return entry.fixtures.map((fixture) => ({
    name: fixture.name,
    mode: fixtureRenderMode(fixture),
    fixtureContentHash: entry.contentHash,
    ...(fixture.interact !== undefined ? { interact: fixture.interact } : {}),
    ...(fixture.mask !== undefined ? { mask: fixture.mask } : {}),
    category: fixture.category,
  }));
}

export function findFixture(
  entry: LoadedFixtureFile,
  fixtureName: string,
): VisualFixture | undefined {
  return entry.fixtures.find((fixture) => fixture.name === fixtureName);
}

export function resolveFixtureHostPath(entry: LoadedFixtureFile, fixture: VisualFixture): string {
  if (fixtureRenderMode(fixture) !== 'host') {
    throw new Error(`[${entry.componentName}] Fixture '${fixture.name}' is not a host fixture.`);
  }
  if (typeof fixture.host !== 'string') {
    throw new Error(`[${entry.componentName}] Fixture '${fixture.name}' host is missing.`);
  }

  if (!fixture.host.startsWith('./')) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host must be a relative './*.fixture.svelte' path.`,
    );
  }
  if (!fixture.host.endsWith('.fixture.svelte')) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host '${fixture.host}' must end in .fixture.svelte.`,
    );
  }

  const componentDirectory = dirname(entry.sourcePath);
  const hostPath = resolve(componentDirectory, fixture.host);
  const relativeHostPath = relative(componentDirectory, hostPath);
  if (relativeHostPath.startsWith('..') || isAbsolute(relativeHostPath)) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host '${fixture.host}' must stay inside the component directory.`,
    );
  }
  if (!existsSync(hostPath)) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host '${fixture.host}' does not exist.`,
    );
  }
  return hostPath;
}

export function componentSourcePath(slug: string): string {
  return join(DEFAULT_COMPONENTS_ROOT, slug, `${slug}.svelte`);
}
