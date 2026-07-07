import { plugin } from 'bun';

import { setupHappyDom } from '../src/test/happy-dom.ts';
import { registerGlobalCleanup } from '../src/test/register-global-cleanup.ts';
import { sveltePlugin } from './svelte-plugin.ts';

// Install happy-dom DOM globals BEFORE any test file's static imports resolve.
// Two reasons:
//
//   1. Several test files (notably review-editor / commentary integrations)
//      transitively import `decode-named-character-reference/index.dom.js`,
//      which reads `document` at module-init under the `browser` export
//      condition. Without globals installed at preload time, those imports
//      fail before any test body runs.
//
//   2. Pre-installing happy-dom lets every test file use a STATIC import for
//      `@testing-library/svelte` instead of a top-level `await import(...)`.
//      Bun's test runner deadlocks when many test files race to dynamically
//      import the same module at module-init time (a real reproducible bug
//      — banner + number-input alone hangs together). Static imports avoid
//      the race.
setupHappyDom();

await plugin(sveltePlugin({ generate: 'client' }));

// Register ONE global afterEach(cleanup) here, before any test file loads, so
// every component test's render() is unmounted without each file needing its
// own cleanup boilerplate. See register-global-cleanup.ts for the full why.
await registerGlobalCleanup();
