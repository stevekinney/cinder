import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { outcomeOf, rethrow } from './module-scope-outcome.ts';
import { rejectionOf } from './promise-outcome.ts';
import {
  importSvelteOnServer,
  prepareSvelteServerSource,
  renderSvelteOnServer,
} from './svelte-server.ts';

const sourcePath = resolve(import.meta.dir, '../fixtures/svelte-plugin-component.svelte');
const unsafeSourcePath = resolve(import.meta.dir, '../fixtures/svelte-server-unsafe.svelte');
const stateSource = resolve(import.meta.dir, '../fixtures/svelte-server-state.svelte');

// Compile at module scope, where no test timeout applies; each test only renders.
// The state fixture is prepared twice concurrently to cover shared compilation.
await Promise.all([
  prepareSvelteServerSource(sourcePath),
  prepareSvelteServerSource(unsafeSourcePath),
  prepareSvelteServerSource(stateSource),
  prepareSvelteServerSource(stateSource),
]);

// Prepare one scratch source under the browser conditions, edit it, then prepare
// the default conditions: each render must replay the compilation for its own key.
const conditionsDirectory = await mkdtemp(
  resolve(import.meta.dir, '../../node_modules/.svelte-prepare-'),
);
afterAll(() => rm(conditionsDirectory, { recursive: true }));
const conditionsSource = join(conditionsDirectory, 'prepared.svelte');
await Bun.write(conditionsSource, '<p>prepared</p>');
await prepareSvelteServerSource(conditionsSource, { conditions: ['browser', 'svelte'] });
await Bun.write(conditionsSource, '<p>edited</p>');
await prepareSvelteServerSource(conditionsSource);

const scratchFiles = async () => {
  const names = await readdir(resolve(import.meta.dir, '../../node_modules'));
  return names.filter((name) => name.startsWith('.svelte-ssr-')).toSorted();
};

// Each scenario starts a real server process, so it runs here at module scope, off the per-test
// clock, and strictly in sequence because two of them compare the shared scratch directory
// before and after. Its test rethrows whatever the scenario threw.
const renders = await outcomeOf(async () => {
  const before = await scratchFiles();
  const html = await renderSvelteOnServer(sourcePath, { name: 'server' });
  expect(html).toContain('<p>Hello server</p>');
  expect(await scratchFiles()).toEqual(before);
});

const imports = await outcomeOf(async () => {
  await importSvelteOnServer(sourcePath);
});

const browserGlobals = await outcomeOf(async () => {
  const before = await scratchFiles();
  const error = await rejectionOf(importSvelteOnServer(unsafeSourcePath));
  expect(error).toBeInstanceOf(Error);
  expect(error instanceof Error ? error.message : '').toContain('document is not defined');
  expect(await scratchFiles()).toEqual(before);
});

const omittedProps = await outcomeOf(async () => {
  const error = await rejectionOf(renderSvelteOnServer(sourcePath, { name: () => 'lost' }));
  expect(error).toBeInstanceOf(TypeError);
  expect(error instanceof Error ? error.message : '').toContain('Server props must contain data');
});

const freshState = await outcomeOf(async () => {
  const first = await renderSvelteOnServer(stateSource);
  const second = await renderSvelteOnServer(stateSource);
  expect(first).toContain('<p>Render 1</p>');
  expect(second).toBe(first);
});

const preparedConditions = await outcomeOf(async () => {
  expect(
    await renderSvelteOnServer(conditionsSource, {}, { conditions: ['browser', 'svelte'] }),
  ).toContain('<p>prepared</p>');
  expect(await renderSvelteOnServer(conditionsSource)).toContain('<p>edited</p>');
});

describe('isolated Svelte server execution', () => {
  test('renders source with the real Svelte server runtime', () => rethrow(renders));

  test('evaluates server components without mounting them', () => rethrow(imports));

  test('rejects module evaluation that reads browser globals', () => rethrow(browserGlobals));

  test('rejects props that JSON would silently omit', () => rethrow(omittedProps));

  test('preparing a fixture preserves fresh module state for every render', () =>
    rethrow(freshState));

  test('preparing under explicit conditions compiles the entry those conditions render', () =>
    rethrow(preparedConditions));
});
