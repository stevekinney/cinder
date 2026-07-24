import { readdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, expect, test } from 'bun:test';

const fixtureDirectory = resolve(import.meta.dir, '../../../fixtures/shiki-curated-vite');
const outputDirectory = resolve(fixtureDirectory, '.dist');
const viteExecutable = resolve(fixtureDirectory, '../../../../node_modules/.bin/vite');

afterEach(async () => {
  await rm(outputDirectory, { recursive: true, force: true });
});

test('Vite curated Shiki fixture emits only configured language and theme candidates', async () => {
  await Bun.$`${viteExecutable} build ${fixtureDirectory} --config ${resolve(fixtureDirectory, 'vite.config.ts')} --outDir ${outputDirectory}`;
  const assets = await readdir(resolve(outputDirectory, 'assets'));
  const assetNames = assets.join('\n');
  expect(assetNames).toContain('typescript');
  expect(assetNames).toContain('github-light');
  expect(assetNames).not.toContain('javascript');
  expect(assetNames).not.toContain('github-dark');
  expect(assetNames).not.toContain('python');
  const oversized = [];
  for (const asset of assets) {
    const metadata = await stat(resolve(outputDirectory, 'assets', asset));
    const size = metadata.size;
    if (size > 500 * 1024) oversized.push({ asset, size });
  }
  // Oniguruma's WASM payload is the only expected chunk above Vite's default
  // warning threshold; keep it bounded so the fixture cannot hide regressions.
  expect(oversized).toHaveLength(1);
  expect(oversized[0]?.asset).toContain('wasm');
  expect(oversized[0]?.size).toBeLessThan(700 * 1024);
});
