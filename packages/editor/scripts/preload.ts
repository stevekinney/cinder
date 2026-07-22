import { plugin } from 'bun';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { setupHappyDom } from '../src/lib/test/happy-dom.ts';
import { registerGlobalCleanup } from '../src/lib/test/register-global-cleanup.ts';

setupHappyDom();
await plugin(sveltePlugin({ generate: 'client' }));
await registerGlobalCleanup();
