import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { __serverRenderBuildCacheForTests, prepareServerRenderSource } from './server-render.ts';

const INPUT_SOURCE = join(import.meta.dir, '..', 'components', 'input', 'input.svelte');

test('prepareServerRenderSource coalesces concurrent builds for one immutable fixture', async () => {
  __serverRenderBuildCacheForTests.evict(INPUT_SOURCE);
  const buildCountBefore = __serverRenderBuildCacheForTests.buildCount(INPUT_SOURCE);

  await Promise.all([
    prepareServerRenderSource(INPUT_SOURCE),
    prepareServerRenderSource(INPUT_SOURCE),
  ]);

  expect(__serverRenderBuildCacheForTests.buildCount(INPUT_SOURCE) - buildCountBefore).toBe(1);
});
