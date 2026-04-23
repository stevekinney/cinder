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
    type LoadArguments = { path: string };
    type LoadResult = { contents: string; loader: string };
    type LoadHandler = (input: LoadArguments) => Promise<LoadResult>;
    type MinimalSetupBuilder = {
      onLoad(filter: { filter: RegExp }, handler: LoadHandler): void;
    };

    let registeredLoadHandler: LoadHandler | undefined;
    const builderStub: MinimalSetupBuilder = {
      onLoad(_filter, handler) {
        registeredLoadHandler = handler;
      },
    };
    // The real builder has more surface but the plugin only calls onLoad.
    plugin.setup(builderStub as Parameters<typeof plugin.setup>[0]);

    if (!registeredLoadHandler) throw new Error('plugin did not register onLoad');

    const fixturePath = `${import.meta.dir}/.forbidden-style-fixture.svelte`;
    await Bun.write(
      fixturePath,
      `<script>let x = 1;</script><p>{x}</p><style>p { color: red; }</style>`,
    );

    try {
      await expect(registeredLoadHandler({ path: fixturePath })).rejects.toThrow(
        /<style> block in .* not allowed/,
      );
    } finally {
      await Bun.file(fixturePath).delete();
    }
  });
});

describe('component AST', () => {
  const componentGlob = new Glob('components/*.svelte');
  const componentPaths: string[] = [];

  for (const componentPath of componentGlob.scanSync({
    cwd: import.meta.dir,
    absolute: true,
  })) {
    componentPaths.push(componentPath);
  }

  test('at least one component exists', () => {
    expect(componentPaths.length).toBeGreaterThan(0);
  });

  test.each(componentPaths)('%s has no <style> block (ast.css === null)', async (componentPath) => {
    const source = await Bun.file(componentPath).text();
    const abstractSyntaxTree = parse(source, { modern: true });
    expect(abstractSyntaxTree.css).toBeNull();
  });
});
