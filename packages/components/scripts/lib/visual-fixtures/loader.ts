import { join, resolve } from 'node:path';

import {
  loadFixtureFile as loadStaticFixtureFile,
  resolveFixtureFilePath as resolveStaticFixtureFilePath,
  resolveFixtureHostPath as resolveStaticFixtureHostPath,
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
  return resolveStaticFixtureHostPath(entry, fixture);
}

export function componentSourcePath(slug: string): string {
  return join(DEFAULT_COMPONENTS_ROOT, slug, `${slug}.svelte`);
}
