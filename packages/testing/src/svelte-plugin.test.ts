import { plugin } from 'bun';
import { beforeAll, describe, expect, mock, test } from 'bun:test';
import * as svelteCompiler from 'svelte/compiler';

import {
  compileSvelteComponentForBun,
  compileSvelteRuneModuleForBun,
  sveltePlugin,
} from './svelte-plugin.ts';

// A pass-through spy on the compiler's `parse`, so a test can count how many times the
// plugin parses a component beyond the parse `compile` performs internally. The real
// functions are captured before the mock replaces the module's live bindings, because
// calling through the namespace afterward would recurse into the spy. Module mocks
// persist for the process, so the spy counts only while a test resets the counter.
const realCompiler = { ...svelteCompiler };
let parseCallCount = 0;
mock.module('svelte/compiler', () => ({
  ...realCompiler,
  parse: (...parseArguments: Parameters<typeof svelteCompiler.parse>) => {
    parseCallCount += 1;
    return realCompiler.parse(...parseArguments);
  },
}));

beforeAll(async () => {
  await plugin(sveltePlugin({ generate: 'client' }));
});

describe('sveltePlugin', () => {
  test('does not parse a component a second time when no style-block policy is configured', () => {
    const source = '<p>Library component</p><style>p { color: red; }</style>';
    const options = { generate: 'server', injectCss: false } as const;

    parseCallCount = 0;
    compileSvelteComponentForBun(source, 'library.svelte', options, {});

    expect(parseCallCount).toBe(0);
  });

  test('still parses to enforce the style-block policy when one is configured', () => {
    const source = '<p>Fixture</p><style>p { color: red; }</style>';
    const options = { generate: 'server', injectCss: false } as const;

    parseCallCount = 0;
    expect(() =>
      compileSvelteComponentForBun(source, 'fixture.svelte', options, {
        allowStyleBlock: () => false,
      }),
    ).toThrow('<style> block in fixture.svelte is not allowed');
    expect(parseCallCount).toBe(1);
  });

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
