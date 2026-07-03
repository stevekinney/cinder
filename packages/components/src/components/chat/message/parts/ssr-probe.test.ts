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
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, test } from 'bun:test';
import { compile } from 'svelte/compiler';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
import { importWithoutDomGlobals } from '../../../../test/import-without-dom-globals.ts';

setupHappyDom();

const serverProbeTempDirectory = resolve(import.meta.dir, '../../../../..', 'tmp', 'ssr-probe');
let serverProbeModuleCounter = 0;

function rewriteRelativeImports(code: string, sourceDirectory: string): string {
  return code.replaceAll(
    /(\bfrom\s*|\bimport\s*)(['"])(\.[^'"]+)\2/g,
    (_match, prefix: string, quote: string, specifier: string) =>
      `${prefix}${quote}${pathToFileURL(resolve(sourceDirectory, specifier)).href}${quote}`,
  );
}

async function importServerCompiledSvelteWithoutDomGlobals(
  sourcePath: string,
  label: string,
): Promise<string | undefined> {
  const source = await Bun.file(sourcePath).text();
  const compiled = compile(source, {
    filename: sourcePath,
    generate: 'server',
    css: 'external',
    dev: false,
  });

  await mkdir(serverProbeTempDirectory, { recursive: true });
  const moduleLabel = `${label}-${++serverProbeModuleCounter}`;
  const modulePath = join(
    serverProbeTempDirectory,
    `.cinder-ssr-${moduleLabel}-${process.pid}-${Date.now()}.mjs`,
  );
  await Bun.write(modulePath, rewriteRelativeImports(compiled.js.code, dirname(sourcePath)));

  try {
    return await importWithoutDomGlobals([pathToFileURL(modulePath).href]);
  } finally {
    await rm(modulePath, { force: true });
  }
}

describe('parts spine — SSR safety', () => {
  test('deriveMessageParts imports with no DOM globals at module level', async () => {
    // Resolve to an absolute path here (not in the shared helper) so the dynamic
    // import inside the helper doesn't resolve the specifier relative to its own
    // module location.
    const utilitiesPath = resolve(import.meta.dir, '..', '..', 'utilities', 'utilities.ts');
    const utilitiesUrl = pathToFileURL(utilitiesPath).href;
    const probe = Bun.spawn({
      cmd: [
        process.execPath,
        '-e',
        [
          "Reflect.deleteProperty(globalThis, 'document');",
          "Reflect.deleteProperty(globalThis, 'window');",
          `await import(${JSON.stringify(utilitiesUrl)});`,
        ].join(''),
      ],
      stderr: 'pipe',
      stdout: 'pipe',
    });

    const [exitCode, stderr] = await Promise.all([probe.exited, new Response(probe.stderr).text()]);

    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
  });

  test('server compilation of the parts renderer imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, '..', 'chat-message-parts-renderer.svelte');
    const threwMessage = await importServerCompiledSvelteWithoutDomGlobals(sourcePath, 'parts');
    expect(threwMessage).toBeUndefined();
  });

  test('(C4) reasoning-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'reasoning-part.svelte');
    const threwMessage = await importServerCompiledSvelteWithoutDomGlobals(sourcePath, 'reasoning');
    expect(threwMessage).toBeUndefined();
  });

  test('(C4) step-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'step-part.svelte');
    const threwMessage = await importServerCompiledSvelteWithoutDomGlobals(sourcePath, 'step');
    expect(threwMessage).toBeUndefined();
  });

  test('tool-approval-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'tool-approval-part.svelte');
    const threwMessage = await importServerCompiledSvelteWithoutDomGlobals(
      sourcePath,
      'tool-approval',
    );
    expect(threwMessage).toBeUndefined();
  });

  test('(C5) suggestion-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'suggestion-part.svelte');
    const threwMessage = await importServerCompiledSvelteWithoutDomGlobals(
      sourcePath,
      'suggestion',
    );
    expect(threwMessage).toBeUndefined();
  });
});
