import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

import { sveltePlugin } from '../scripts/svelte-plugin.ts';
import Button from './components/button.svelte';

describe('svelte plugin', () => {
  test('compiles Button to a callable', () => {
    expect(typeof Button).toBe('function');
  });

  test('rejects components containing a <style> block', async () => {
    const plugin = sveltePlugin({ generate: 'client' });
    type LoadArgs = { path: string };
    type LoadResult = { contents: string; loader: string };
    type LoadHandler = (args: LoadArgs) => Promise<LoadResult>;
    type SetupBuilder = {
      onLoad(filter: { filter: RegExp }, handler: LoadHandler): void;
    };

    let onLoadHandler: LoadHandler | undefined;
    const builder: SetupBuilder = {
      onLoad(_filter, handler) {
        onLoadHandler = handler;
      },
    };
    // The real builder has more surface but the plugin only calls onLoad.
    plugin.setup(builder as Parameters<typeof plugin.setup>[0]);

    if (!onLoadHandler) throw new Error('plugin did not register onLoad');

    const tempPath = `${import.meta.dir}/.forbidden-style-fixture.svelte`;
    await Bun.write(
      tempPath,
      `<script>let x = 1;</script><p>{x}</p><style>p { color: red; }</style>`,
    );

    try {
      await expect(onLoadHandler({ path: tempPath })).rejects.toThrow(
        /<style> block in .* not allowed/,
      );
    } finally {
      await Bun.file(tempPath).delete();
    }
  });
});

describe('component AST', () => {
  const glob = new Glob('components/*.svelte');
  const componentFiles: string[] = [];

  for (const file of glob.scanSync({ cwd: import.meta.dir, absolute: true })) {
    componentFiles.push(file);
  }

  test('at least one component exists', () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  test.each(componentFiles)('%s has no <style> block (ast.css === null)', async (file) => {
    const source = await Bun.file(file).text();
    const ast = parse(source, { modern: true });
    expect(ast.css).toBeNull();
  });
});
