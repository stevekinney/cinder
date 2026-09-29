import { plugin } from 'bun';
import { beforeAll, describe, expect, test } from 'bun:test';

import {
  compileSvelteComponentForBun,
  compileSvelteRuneModuleForBun,
  sveltePlugin,
} from './svelte-plugin.ts';

beforeAll(async () => {
  await plugin(sveltePlugin({ generate: 'client' }));
});

describe('sveltePlugin', () => {
  test('explicit build mode controls component diagnostics independently of the host process', () => {
    const source = '<p>Browser fixture</p>';
    const options = { generate: 'client', injectCss: true } as const;
    const development = compileSvelteComponentForBun(source, 'fixture.svelte', options, {}, true);
    const production = compileSvelteComponentForBun(source, 'fixture.svelte', options, {}, false);

    expect(development.contents).toContain('check_target');
    expect(production.contents).not.toContain('check_target');
    expect(production.contents).not.toContain('mark_module_start');
  });

  test('explicit build mode also controls rune-module diagnostics', () => {
    const source = 'export class Counter { count = $state(0); }';
    const development = compileSvelteRuneModuleForBun(source, 'counter.svelte.ts', 'client', true);
    const production = compileSvelteRuneModuleForBun(source, 'counter.svelte.ts', 'client', false);

    expect(development.contents).toContain('$.tag');
    expect(production.contents).not.toContain('$.tag');
  });

  test('executes a real Svelte component through Bun dynamic import', async () => {
    const module = await import('./fixtures/svelte-plugin-component.svelte');
    expect(typeof module.default).toBe('function');
  });

  test('executes a real rune module through Bun dynamic import', async () => {
    const module = await import('./fixtures/svelte-plugin-counter.svelte.ts');
    const counter = new module.Counter();

    counter.increment();

    expect(counter.count).toBe(1);
  });

  test('compiles a real Svelte component for server output', async () => {
    const fixturePath = `${import.meta.dir}/fixtures/svelte-plugin-component.svelte`;
    const result = compileSvelteComponentForBun(
      await Bun.file(fixturePath).text(),
      fixturePath,
      { generate: 'server', injectCss: false },
      {},
    );

    expect(result.loader).toBe('js');
    expect(result.contents).toContain('export default');
  });
});
