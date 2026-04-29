import { plugin } from 'bun';
import { mock } from 'bun:test';

import { sveltePlugin } from '../packages/components/scripts/svelte-plugin.ts';

process.env.TZ ??= 'UTC';
process.env.LANG ??= 'en_US.UTF-8';

const svelteBrowserEntries = new Map([
  ['svelte', '../node_modules/svelte/src/index-client.js'],
  ['svelte/legacy', '../node_modules/svelte/src/legacy/legacy-client.js'],
  ['svelte/reactivity', '../node_modules/svelte/src/reactivity/index-client.js'],
  ['svelte/store', '../node_modules/svelte/src/store/index-client.js'],
]);

function localPath(relativePath: string): string {
  return new URL(relativePath, import.meta.url).pathname;
}

for (const [specifier, browserEntry] of svelteBrowserEntries) {
  const browserModule = await import(localPath(browserEntry));
  mock.module(specifier, () => browserModule);
}

await plugin(sveltePlugin({ generate: 'client' }));
