import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Theme, ViewportName } from './manifest.ts';

export type ArtifactKey = { slug: string; theme: Theme; viewport: ViewportName };

function packageRoot(): string {
  // src/helpers/artifact-path.ts → ../..
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function screenshotPath(key: ArtifactKey): string {
  return resolve(packageRoot(), 'screenshots', key.slug, `${key.theme}-${key.viewport}.png`);
}

export function axeJsonPath(key: ArtifactKey): string {
  return resolve(
    packageRoot(),
    'test-results',
    'axe',
    key.slug,
    `${key.theme}-${key.viewport}.json`,
  );
}
