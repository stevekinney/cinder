import { plugin } from 'bun';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';
import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';

// Mirrors the components-package preload so playground tests that render
// `.svelte` files (e.g., the EventSource attachment test) can resolve and
// compile components.
setupHappyDom();

await plugin(sveltePlugin({ generate: 'client' }));
