import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadRepositorySources } from './css-usage-inventory.ts';

test('loads owned HTML and production fixtures while excluding established test roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-inventory-sources-'));
  const included = [
    'packages/components/src/styles/tokens-base.css',
    'packages/playground/src/index.html',
    'packages/playground/src/examples/fixture.example.svelte',
    'packages/playground/src/fixtures/production.svelte',
  ];
  const excluded = [
    'packages/components/src/test/fixtures/browser.svelte',
    'packages/chat/src/lib/test/fixtures/browser.svelte',
    'packages/editor/src/lib/test/helper.ts',
    'packages/markdown/src/__tests__/fixture.ts',
    'packages/playground/src/example.test.ts',
    'packages/playground/src/example.spec.ts',
    'packages/playground/src/example.playwright.ts',
  ];
  try {
    for (const path of [...included, ...excluded]) {
      const absolute = join(root, path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, path.endsWith('.css') ? ':root { --public: red; }' : '<div />');
    }
    const sources = await loadRepositorySources(root);
    expect(sources.map((source) => source.path)).toEqual(included.toSorted());
    expect(
      sources.filter((source) => source.globalDefinitions).map((source) => source.path),
    ).toEqual([included[0]!]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
