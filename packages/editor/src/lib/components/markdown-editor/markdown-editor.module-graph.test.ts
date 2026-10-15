/**
 * COR-1322: the module graph Bun actually loads for `MarkdownEditor`.
 *
 * `markdown-editor.import-boundary.test.ts` proves the static import graph
 * reaches no Milkdown or ProseMirror module. This test proves the same thing
 * at runtime: a fresh Bun process registers the Svelte loader, imports
 * `markdown-editor.svelte`, and reports every module in Bun's loader registry
 * (`require.cache`, which lists ES modules as well as CommonJS ones). A fresh
 * process is required because this test process has long since loaded the
 * editor runtime through other test files.
 *
 * The positive control imports `editor.ts` the same way and must find Milkdown
 * and ProseMirror, so a registry that stopped listing modules would fail here
 * rather than pass vacuously.
 */

import { describe, expect, it } from 'bun:test';

const PACKAGE_ROOT = new URL('../../../../', import.meta.url).pathname;
const PROTECTED_MODULE_PATH = /\/node_modules\/(?:@milkdown\/|prosemirror-)/;

/** Import `entry` in a fresh Bun process and return every module path it loaded. */
async function modulesLoadedBy(entry: string): Promise<string[]> {
  const entryPath = new URL(entry, import.meta.url).pathname;
  const childSource = `
    import { setupHappyDom, sveltePlugin } from '@lostgradient/testing';
    import { plugin } from 'bun';
    setupHappyDom();
    await plugin(sveltePlugin({ generate: 'client' }));
    await import(${JSON.stringify(entryPath)});
    process.stdout.write(JSON.stringify(Object.keys(require.cache)));
  `;
  const child = Bun.spawn(
    [process.execPath, '--conditions', 'browser', '--conditions', 'svelte', '-e', childSource],
    // `timeout` is a hang detector for a child that never exits, never a performance bound.
    { cwd: PACKAGE_ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`[module-graph] child Bun exited ${exitCode} importing ${entry}:\n${stderr}`);
  }
  const loaded: unknown = JSON.parse(stdout);
  if (!Array.isArray(loaded) || !loaded.every((path) => typeof path === 'string')) {
    throw new Error(`[module-graph] unexpected child output: ${stdout.slice(0, 200)}`);
  }
  return loaded;
}

// Both fresh Bun processes are the behavior under test (a clean module registry), so they run
// here at module scope, off the per-test clock, and the tests only assert.
const [componentModules, runtimeModules] = await Promise.all([
  modulesLoadedBy('./markdown-editor.svelte'),
  modulesLoadedBy('../../editor/editor.ts'),
]);

describe('MarkdownEditor runtime module graph (COR-1322)', () => {
  it('importing markdown-editor.svelte loads no Milkdown or ProseMirror module', () => {
    const loaded = componentModules;
    expect(loaded.some((path) => path.endsWith('/markdown-editor/markdown-editor.svelte'))).toBe(
      true,
    );
    expect(loaded.some((path) => path.endsWith('/editor/attach.ts'))).toBe(true);
    expect(loaded.filter((path) => PROTECTED_MODULE_PATH.test(path))).toEqual([]);
  });

  it('positive control: importing the editor runtime loads Milkdown and ProseMirror', () => {
    const loaded = runtimeModules;
    expect(loaded.some((path) => /\/node_modules\/@milkdown\//.test(path))).toBe(true);
    expect(loaded.some((path) => /\/node_modules\/prosemirror-/.test(path))).toBe(true);
  });
});
