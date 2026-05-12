import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ComponentEntry = { name: string; slug: string; route: string };

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const playgroundUrl = process.env['PLAYGROUND_URL'] ?? 'http://localhost:4173';

type RawManifestEntry = {
  name: string;
  kebabName: string;
  file: string;
  importPath: string;
  props: unknown[];
};

async function main(): Promise<void> {
  const response = await fetch(`${playgroundUrl}/api/manifest`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as RawManifestEntry[];

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

  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
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
