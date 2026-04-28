/**
 * Register a happy-dom Window on Node's globalThis so `@testing-library/svelte` — which
 * expects `document`, `window`, and the usual DOM globals — can mount components in Bun's
 * test runner. Bun doesn't ship a DOM, and happy-dom doesn't include a Bun-native global
 * registrator, so we wire it up by hand.
 *
 * Called from test files via top-level `setupHappyDom()` before dynamic-importing
 * `@testing-library/svelte`. The dynamic import is important: testing-library reads
 * `globalThis.document` during module init, so it must load AFTER happy-dom is installed.
 */
import { Window } from 'happy-dom';

type Global = typeof globalThis & Record<string, unknown>;

let installed = false;

export function setupHappyDom(): void {
  if (installed) return;
  const happyWindow = new Window();
  const target = globalThis as Global;

  // Copy each own property defined on the happy-dom Window (DOM globals: document, Node,
  // Element, MouseEvent, etc.) onto Node's globalThis. Skip properties that already exist on
  // globalThis (e.g., `fetch`, `URL`) so we don't clobber Bun's own implementations.
  for (const key of Object.getOwnPropertyNames(happyWindow)) {
    if (key in target) continue;
    const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
    if (!descriptor) continue;
    Object.defineProperty(target, key, descriptor);
  }
  // happy-dom's Window isn't structurally assignable to the DOM's `Window & typeof globalThis`
  // (happy-dom implements a subset). For test-globals purposes the subset is sufficient.
  // Using defineProperty sidesteps the lib.dom.d.ts `window` type on globalThis.
  Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });

  installed = true;
}
