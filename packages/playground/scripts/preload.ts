import { plugin } from 'bun';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { setupHappyDom } from '../../components/src/test/happy-dom.ts';

// Mirrors the components-package preload so playground tests that render
// `.svelte` files (e.g., the EventSource attachment test) can resolve and
// compile components.
setupHappyDom();

await plugin(sveltePlugin({ generate: 'client' }));
