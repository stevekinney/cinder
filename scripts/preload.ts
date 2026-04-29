import { plugin } from 'bun';

import { sveltePlugin } from '../packages/components/scripts/svelte-plugin.ts';

await plugin(sveltePlugin({ generate: 'client' }));
