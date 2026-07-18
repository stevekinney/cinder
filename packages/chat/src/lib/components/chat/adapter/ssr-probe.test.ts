/**
 * SSR import-safety probe for the adapter seam.
 *
 * `chat-adapter.ts` is type-only — it ships no runtime code and imports nothing
 * at runtime — so importing it with the DOM globals removed from the realm must
 * not throw. (The substantive wiring lives in `container/chat.svelte` behind an
 * `$effect`, which never runs at module evaluation; the outer-shell SSR guard in
 * `chat.test.ts` covers that surface.)
 */

/// <reference lib="dom" />
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import { importWithoutDomGlobals } from '../../../test/import-without-dom-globals.ts';

setupHappyDom();

describe('adapter seam — SSR safety', () => {
  test('the adapter module imports with no DOM globals at module level', async () => {
    // Absolute paths so the dynamic import inside the shared helper resolves them
    // from here, not relative to the helper's own module location.
    const threwMessage = await importWithoutDomGlobals([
      resolve(import.meta.dir, 'chat-adapter.ts'),
      resolve(import.meta.dir, 'index.ts'),
    ]);
    expect(threwMessage).toBeUndefined();
  });
});
