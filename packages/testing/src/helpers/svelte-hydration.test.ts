import { plugin } from 'bun';
import { beforeAll, expect, mock, test } from 'bun:test';

import { sveltePlugin } from '../svelte-plugin.ts';

// This package's tests run without the `browser` export condition, so a bare `svelte` import
// resolves to the server entry, where `hydrate` throws. Point it at the client entry for this file.
const svelteClientEntry = new URL(
  './src/index-client.js',
  import.meta.resolve('svelte/package.json'),
).href;
mock.module('svelte', () => import(svelteClientEntry));
const { hydrateServerHtml } = await import('./svelte-hydration.ts');

// Literal server markup for `fixtures/svelte-plugin-component.svelte` with `name: 'Corvidae'`, so
// hydration is exercised here without spawning a server process.
const serverHtml = '<!--[--><p>Hello Corvidae</p><!--]-->';

beforeAll(async () => {
  await plugin(sveltePlugin({ generate: 'client' }));
});

test('hydrates supplied server HTML without warnings and reports it', async () => {
  const { default: Component } = await import('../fixtures/svelte-plugin-component.svelte');
  const result = hydrateServerHtml(Component, serverHtml, { name: 'Corvidae' });

  try {
    expect(result.ssrHtml).toBe(serverHtml);
    expect(result.container.parentElement).toBe(document.body);
    expect(result.container.querySelector('p')?.textContent).toBe('Hello Corvidae');
    expect(result.warnings).toEqual([]);
  } finally {
    await result.cleanup();
  }
  expect(result.container.isConnected).toBe(false);
});
