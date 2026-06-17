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
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
import { importWithoutDomGlobals } from '../../../../test/import-without-dom-globals.ts';

setupHappyDom();

describe('parts spine — SSR safety', () => {
  test('deriveMessageParts imports with no DOM globals at module level', async () => {
    // Resolve to an absolute path here (not in the shared helper) so the dynamic
    // import inside the helper doesn't resolve the specifier relative to its own
    // module location.
    const utilitiesPath = resolve(import.meta.dir, '..', '..', 'utilities', 'utilities.ts');
    const threwMessage = await importWithoutDomGlobals([utilitiesPath]);
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

  test('(C4) reasoning-part.svelte imports with no DOM globals at module level', async () => {
    const { compile } = await import('svelte/compiler');
    const { dirname, join, resolve } = await import('node:path');
    const { writeFile, rm } = await import('node:fs/promises');

    const sourcePath = resolve(import.meta.dir, 'reasoning-part.svelte');
    const source = await Bun.file(sourcePath).text();
    const compiled = compile(source, {
      filename: sourcePath,
      generate: 'server',
      css: 'external',
      dev: false,
    });

    const ssrFileName = `.cinder-ssr-reasoning-${process.pid}-${Date.now()}.mjs`;
    const ssrFile = join(dirname(sourcePath), ssrFileName);
    await writeFile(ssrFile, compiled.js.code, 'utf-8');

    try {
      const threwMessage = await importWithoutDomGlobals([ssrFile]);
      expect(threwMessage).toBeUndefined();
    } finally {
      await rm(ssrFile, { force: true });
    }
  });

  test('(C4) step-part.svelte imports with no DOM globals at module level', async () => {
    const { compile } = await import('svelte/compiler');
    const { dirname, join, resolve } = await import('node:path');
    const { writeFile, rm } = await import('node:fs/promises');

    const sourcePath = resolve(import.meta.dir, 'step-part.svelte');
    const source = await Bun.file(sourcePath).text();
    const compiled = compile(source, {
      filename: sourcePath,
      generate: 'server',
      css: 'external',
      dev: false,
    });

    const ssrFileName = `.cinder-ssr-step-${process.pid}-${Date.now()}.mjs`;
    const ssrFile = join(dirname(sourcePath), ssrFileName);
    await writeFile(ssrFile, compiled.js.code, 'utf-8');

    try {
      const threwMessage = await importWithoutDomGlobals([ssrFile]);
      expect(threwMessage).toBeUndefined();
    } finally {
      await rm(ssrFile, { force: true });
    }
  });

  test('tool-approval-part.svelte imports with no DOM globals at module level', async () => {
    const { compile } = await import('svelte/compiler');
    const { dirname, join, resolve } = await import('node:path');
    const { writeFile, rm } = await import('node:fs/promises');

    const sourcePath = resolve(import.meta.dir, 'tool-approval-part.svelte');
    const source = await Bun.file(sourcePath).text();
    const compiled = compile(source, {
      filename: sourcePath,
      generate: 'server',
      css: 'external',
      dev: false,
    });

    const ssrFileName = `.cinder-ssr-tool-approval-${process.pid}-${Date.now()}.mjs`;
    const ssrFile = join(dirname(sourcePath), ssrFileName);
    await writeFile(ssrFile, compiled.js.code, 'utf-8');

    try {
      const threwMessage = await importWithoutDomGlobals([ssrFile]);
      expect(threwMessage).toBeUndefined();
    } finally {
      await rm(ssrFile, { force: true });
    }
  });

  test('(C5) suggestion-part.svelte imports with no DOM globals at module level', async () => {
    const { compile } = await import('svelte/compiler');
    const { dirname, join, resolve } = await import('node:path');
    const { writeFile, rm } = await import('node:fs/promises');

    const sourcePath = resolve(import.meta.dir, 'suggestion-part.svelte');
    const source = await Bun.file(sourcePath).text();
    const compiled = compile(source, {
      filename: sourcePath,
      generate: 'server',
      css: 'external',
      dev: false,
    });

    const ssrFileName = `.cinder-ssr-suggestion-${process.pid}-${Date.now()}.mjs`;
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
