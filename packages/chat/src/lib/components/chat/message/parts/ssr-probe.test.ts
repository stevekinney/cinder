import { importSvelteOnServer, prepareSvelteServerSource } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const serverSourcePaths = [
  resolve(import.meta.dir, '..', 'chat-message-parts-renderer.svelte'),
  resolve(import.meta.dir, 'reasoning-part.svelte'),
  resolve(import.meta.dir, 'step-part.svelte'),
  resolve(import.meta.dir, 'tool-approval-part.svelte'),
  resolve(import.meta.dir, 'suggestion-part.svelte'),
];

await Promise.all(serverSourcePaths.map((sourcePath) => prepareSvelteServerSource(sourcePath)));

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
    await importSvelteOnServer(sourcePath);
  });

  test('(C4) reasoning-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'reasoning-part.svelte');
    await importSvelteOnServer(sourcePath);
  });

  test('(C4) step-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'step-part.svelte');
    await importSvelteOnServer(sourcePath);
  });

  test('tool-approval-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'tool-approval-part.svelte');
    await importSvelteOnServer(sourcePath);
  });

  test('(C5) suggestion-part.svelte imports with no DOM globals at module level', async () => {
    const sourcePath = resolve(import.meta.dir, 'suggestion-part.svelte');
    await importSvelteOnServer(sourcePath);
  });
});
