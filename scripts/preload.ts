import { plugin } from 'bun';

import { sveltePlugin } from './svelte-plugin.ts';

await plugin(sveltePlugin({ generate: 'client' }));
