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

    // Plugin registers multiple onLoad handlers (`.svelte` for components, `.svelte.(js|ts)`
    // for rune modules). Capture the one whose filter matches our `.svelte` fixture path.
    let registeredLoadHandler: LoadHandler | undefined;
    const builderStub: MinimalSetupBuilder = {
      onLoad(filter, handler) {
        if (filter.filter.test('fixture.svelte') && !filter.filter.test('fixture.svelte.ts')) {
          registeredLoadHandler = handler;
        }
      },
    };
    // The real builder has more surface but the plugin only calls onLoad.
    plugin.setup(builderStub as Parameters<typeof plugin.setup>[0]);

    if (!registeredLoadHandler) {
      throw new Error('plugin did not register the .svelte onLoad handler');
    }

    const fixturePath = `${import.meta.dir}/.forbidden-style-fixture.svelte`;
    await Bun.write(
      fixturePath,
      `<p class="sample">hi</p>\n<style>\n.sample { color: tomato; }\n</style>\n`,
    );

    try {
      await expect(registeredLoadHandler({ path: fixturePath })).rejects.toThrow(
        /<style> block in .* not allowed/,
      );
    } finally {
      await Bun.file(fixturePath).delete();
    }
  });

  test('compiles .svelte.ts rune modules via compileModule', async () => {
    const plugin = sveltePlugin({ generate: 'client' });
    type LoadArguments = { path: string };
    type LoadResult = { contents: string; loader: string };
    type LoadHandler = (input: LoadArguments) => Promise<LoadResult>;
    type MinimalSetupBuilder = {
      onLoad(filter: { filter: RegExp }, handler: LoadHandler): void;
    };

    // Capture the `.svelte.(js|ts)` handler specifically (not the `.svelte` one).
    let registeredLoadHandler: LoadHandler | undefined;
    const builderStub: MinimalSetupBuilder = {
      onLoad(filter, handler) {
        if (filter.filter.test('fixture.svelte.ts')) {
          registeredLoadHandler = handler;
        }
      },
    };
    plugin.setup(builderStub as Parameters<typeof plugin.setup>[0]);

    if (!registeredLoadHandler) {
      throw new Error('plugin did not register the .svelte.(js|ts) onLoad handler');
    }

    const fixturePath = `${import.meta.dir}/.rune-module-fixture.svelte.ts`;
    await Bun.write(
      fixturePath,
      `export class Counter {\n  count = $state(0);\n  increment() { this.count += 1; }\n}\n`,
    );

    try {
      const result = await registeredLoadHandler({ path: fixturePath });
      expect(result.loader).toBe('js');
      // Prove the rune was actually compiled, not that the source was returned unchanged.
      // compileModule replaces `$state(0)` with Svelte's runtime helpers (`$.state(...)`, etc.)
      // and drops the rune keyword from the emitted code.
      expect(result.contents).toContain('$.state');
      expect(result.contents).not.toContain('$state(');
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
