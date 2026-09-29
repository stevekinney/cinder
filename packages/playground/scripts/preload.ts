import { setupHappyDom, sveltePlugin } from '@lostgradient/testing';
import { plugin } from 'bun';

// Playground tests that render `.svelte` files need the shared DOM setup and
// compiler plugin. The mirror sync moves these helpers into @lostgradient/testing.
setupHappyDom();

await plugin(sveltePlugin({ generate: 'client' }));
