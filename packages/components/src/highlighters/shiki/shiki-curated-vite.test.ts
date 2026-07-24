import { readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, expect, test } from 'bun:test';

const fixtureDirectory = resolve(import.meta.dir, '../../../fixtures/shiki-curated-vite');
const outputDirectory = resolve(import.meta.dir, '.shiki-curated-vite-dist');

afterEach(async () => {
  await rm(outputDirectory, { recursive: true, force: true });
});

test('Vite curated Shiki fixture emits only configured language and theme candidates', async () => {
  const result =
    await Bun.$`${resolve(fixtureDirectory, '../../../../node_modules/.bin/vite')} build ${fixtureDirectory} --config ${resolve(fixtureDirectory, 'vite.config.ts')} --outDir ${outputDirectory}`
      .quiet()
      .nothrow();
  expect(result.exitCode).toBe(0);
  const assets = await readdir(resolve(outputDirectory, 'assets'));
  const assetNames = assets.join('\n');
  expect(assetNames).toContain('typescript');
  expect(assetNames).toContain('github-light');
  expect(assetNames).not.toContain('javascript');
  expect(assetNames).not.toContain('github-dark');
  expect(assetNames).not.toContain('python');
});
