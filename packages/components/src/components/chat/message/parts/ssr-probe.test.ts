/**
 * SSR import-safety probe for the message-parts spine.
 *
 * The parts renderer and every part component must be importable for module
 * evaluation with the DOM globals removed from the realm — i.e. nothing in the
 * parts layer reaches for `document`/`window` at module-evaluation time. The
 * renderer is compiled with `generate: 'server'` and imported under nulled
 * globals; a top-level DOM access would surface as a "not defined" throw on
 * import rather than `undefined`.
 *
 * The `deriveMessageParts` bridge is a pure `.ts` module with no DOM access at
 * all, so it is probed by a direct import under the same nulled globals.
 */

/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../../test/happy-dom.ts';

setupHappyDom();

/**
 * Import the given specifiers with `document`/`window` removed from the realm,
 * restoring them afterward. Returns the first "not defined" error message a
 * module throws on evaluation, or `undefined` if all imported cleanly.
 *
 * Each specifier is cache-busted so Bun re-evaluates the module body under the
 * nulled globals instead of serving a previously-cached instance.
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

describe('parts spine — SSR safety', () => {
  test('deriveMessageParts imports with no DOM globals at module level', async () => {
    const threwMessage = await importWithoutDomGlobals(['../../utilities/utilities.ts']);
    expect(threwMessage).toBeUndefined();
  });

  test('server compilation of the parts renderer imports with no DOM globals at module level', async () => {
    const { compile } = await import('svelte/compiler');
    const { dirname, join, resolve } = await import('node:path');
    const { writeFile, rm } = await import('node:fs/promises');

    const sourcePath = resolve(import.meta.dir, '..', 'chat-message-parts-renderer.svelte');
    const source = await Bun.file(sourcePath).text();
    const compiled = compile(source, {
      filename: sourcePath,
      generate: 'server',
      css: 'external',
      dev: false,
    });

    // Write the SSR module next to the source so its relative imports resolve
    // identically. The `.mjs` extension keeps the preload plugin from
    // recompiling our already-compiled output.
    const ssrFileName = `.cinder-ssr-parts-${process.pid}-${Date.now()}.mjs`;
    const ssrFile = join(dirname(sourcePath), ssrFileName);
    await writeFile(ssrFile, compiled.js.code, 'utf-8');

    try {
      const threwMessage = await importWithoutDomGlobals([ssrFile]);
      expect(threwMessage).toBeUndefined();
    } finally {
      await rm(ssrFile, { force: true });
    }
  });
});
