import { setupHappyDom, sveltePlugin } from '@lostgradient/testing';
import { plugin } from 'bun';

// Mirrors the components-package preload so playground tests that render
// `.svelte` files (e.g., the EventSource attachment test) can resolve and
// compile components. The two helpers used to be relative imports into
// packages/components' own scripts/src, which corvidae no longer carries at
// those paths (they moved into the shared @lostgradient/testing workspace —
// see packages/chat/scripts/preload.ts and packages/components/scripts/preload.ts
// for the same fix already applied there by the mirror sync).
setupHappyDom();

await plugin(sveltePlugin({ generate: 'client' }));
