import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadFixtureFile,
  normalizeFixtureMetadata,
} from '../../components/scripts/lib/visual-fixtures/loader.ts';
import type { ComponentEntry } from '../src/helpers/manifest.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

type RawManifestEntry = {
  name: string;
  kebabName: string;
  file: string;
  importPath: string;
  props: unknown[];
};

function fixtureFilePath(entry: RawManifestEntry): string {
  const sourceDirectory = dirname(entry.file);
  const componentDirectory =
    basename(sourceDirectory) === entry.kebabName
      ? sourceDirectory
      : join(sourceDirectory, entry.kebabName);
  return join(componentDirectory, `${entry.kebabName}-fixtures.ts`);
}

async function main(): Promise<void> {
  const response = await fetch(`${PLAYGROUND_URL}/api/manifest?standalone=1`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as RawManifestEntry[];

  if (raw.length === 0) {
    throw new Error(
      `Manifest at ${PLAYGROUND_URL}/api/manifest?standalone=1 returned zero entries. The playground discovered no standalone components.`,
    );
  }

  const entries: ComponentEntry[] = [];
  for (const entry of raw) {
    const fixtureFile = await loadFixtureFile(fixtureFilePath(entry));
    const fixtures = fixtureFile === null ? undefined : normalizeFixtureMetadata(fixtureFile);
    entries.push({
      name: entry.name,
      slug: entry.kebabName,
      route: `/page/${entry.kebabName}`,
      ...(fixtures !== undefined && fixtures.length > 0 ? { fixtures } : {}),
    });
  }

  const slugsSeen = new Set<string>();
  for (const entry of entries) {
    if (slugsSeen.has(entry.slug)) {
      throw new Error(`Duplicate slug detected: "${entry.slug}"`);
    }
    slugsSeen.add(entry.slug);
  }

  const routesSeen = new Set<string>();
  for (const entry of entries) {
    if (routesSeen.has(entry.route)) {
      throw new Error(`Duplicate route detected: "${entry.route}"`);
    }
    routesSeen.add(entry.route);
  }

  const sorted = [...entries].toSorted((a, b) => a.name.localeCompare(b.name));
  const digest = createHash('sha256')
    .update(JSON.stringify(sorted.map((entry) => ({ name: entry.name, route: entry.route }))))
    .digest('hex');

  const output = { digest, entries };
  const outputDir = resolve(packageRoot, '.playwright');
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, 'manifest.json'), JSON.stringify(output, null, 2) + '\n');

  console.log(`Manifest written: ${entries.length} components, digest ${digest.slice(0, 8)}...`);
}

main().catch((error: unknown) => {
  console.error('prepare-manifest failed:', error);
  process.exit(1);
});
