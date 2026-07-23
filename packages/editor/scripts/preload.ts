import { plugin } from 'bun';
import { mock } from 'bun:test';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { setupHappyDom } from '../src/lib/test/happy-dom.ts';
import { registerGlobalCleanup } from '../src/lib/test/register-global-cleanup.ts';

// `bun test --conditions browser` (required for mounting Svelte components,
// see `test`/`test:coverage` in package.json) leaks the "browser" export
// condition into resolution of every third-party package, not just Svelte's.
// `decode-named-character-reference` (a transitive dependency of
// `@lostgradient/markdown`'s remark/micromark pipeline, reached via the
// editor barrel's anchor-decorations and export surfaces) ships a
// browser-conditioned `index.dom.js` that eagerly calls
// `document.createElement()` at module-evaluation time to build its decode
// table — a real browser optimization, but one that crashes under this
// suite's SSR-safety tests, which delete `document`/`window` to simulate a
// real Node SSR environment. No real environment combines "no DOM globals"
// with "resolve browser builds": a browser has `document`, and Node/SvelteKit
// SSR never passes `--conditions browser`. So this mock isn't papering over a
// real SSR bug — it restores the resolution production actually uses (the
// plain, DOM-free `index.js`) for a package this test-only flag would
// otherwise mis-resolve.
const decodeNamedCharacterReferenceModule = await import(
  new URL('../../../node_modules/decode-named-character-reference/index.js', import.meta.url)
    .pathname
);
await mock.module('decode-named-character-reference', () => decodeNamedCharacterReferenceModule);

setupHappyDom();
await plugin(sveltePlugin({ generate: 'client' }));
await registerGlobalCleanup();
