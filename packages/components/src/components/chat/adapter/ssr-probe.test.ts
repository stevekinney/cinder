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
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

/**
 * Import the given specifiers with `document`/`window` removed from the realm,
 * restoring them afterward. Returns the first "not defined" error message a
 * module throws on evaluation, or `undefined` if all imported cleanly.
 */
async function importWithoutDomGlobals(specifiers: string[]): Promise<string | undefined> {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'document');
  Reflect.deleteProperty(globalThis, 'window');

  try {
    for (const specifier of specifiers) {
      const cacheBusted = `${specifier}${specifier.includes('?') ? '&' : '?'}ssr-eval=${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        await import(cacheBusted);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }
    return undefined;
  } finally {
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    }
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor);
    }
  }
}

describe('adapter seam — SSR safety', () => {
  test('the adapter module imports with no DOM globals at module level', async () => {
    const threwMessage = await importWithoutDomGlobals(['./chat-adapter.ts', './index.ts']);
    expect(threwMessage).toBeUndefined();
  });
});
