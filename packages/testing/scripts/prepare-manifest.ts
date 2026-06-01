import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  const entries: ComponentEntry[] = raw.map((entry) => ({
    name: entry.name,
    slug: entry.kebabName,
    route: `/page/${entry.kebabName}`,
  }));

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
