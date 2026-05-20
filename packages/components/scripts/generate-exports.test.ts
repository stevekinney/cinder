/**
 * Unit tests for the exports generator. Focus areas:
 *
 *   1. Condition ordering: `types` must be first within every entry, followed
 *      by `svelte`, `node`, `default` in that order. TypeScript `nodenext`
 *      requires `types` first; the rest of the order matters for which
 *      resolver wins at runtime.
 *   2. Forbidden-key guard: any exports map containing keys matching
 *      `/__|test|temp|scratch/i` must throw. CI uses this to refuse to ship
 *      debug or scratch subpaths.
 *   3. Root export shape: `.` points at the per-component-build outputs for
 *      `default` and at the preserved single-file server bundle for `node`.
 */

import { describe, expect, it } from 'bun:test';

import {
  assertNoForbiddenExportKeys,
  computeExports,
  computeRootExport,
  FORBIDDEN_EXPORT_KEY_PATTERN,
  orderedExportEntry,
} from './generate-exports.ts';

describe('orderedExportEntry', () => {
  it('emits keys in [types, svelte, node, default] order regardless of input order', () => {
    const entry = orderedExportEntry({
      default: './dist/components/button/index.js',
      node: './dist/server/components/button/index.js',
      svelte: './src/components/button/index.ts',
      types: './dist/components/button/index.d.ts',
    });
    expect(Object.keys(entry)).toEqual(['types', 'svelte', 'node', 'default']);
  });

  it('omits missing conditions but keeps surviving keys in order', () => {
    const entry = orderedExportEntry({
      svelte: './src/components/foo/foo.schema.ts',
      types: './dist/components/foo/foo.schema.d.ts',
    });
    expect(Object.keys(entry)).toEqual(['types', 'svelte']);
  });
});

describe('computeRootExport', () => {
  it('points node at the preserved single-file server bundle and default at the root barrel', () => {
    const root = computeRootExport();
    expect(root).toEqual({
      types: './dist/index.d.ts',
      svelte: './src/index.ts',
      node: './dist/server/index.js',
      default: './dist/index.js',
    });
    expect(Object.keys(root)).toEqual(['types', 'svelte', 'node', 'default']);
  });
});

describe('computeExports', () => {
  it('emits the four-condition shape for component subpaths', () => {
    const out = computeExports([{ name: 'button', isExperimental: false }]);
    expect(out['./button']).toEqual({
      types: './dist/components/button/index.d.ts',
      svelte: './src/components/button/index.ts',
      node: './dist/server/components/button/index.js',
      default: './dist/components/button/index.js',
    });
    expect(Object.keys(out['./button']!)).toEqual(['types', 'svelte', 'node', 'default']);
  });

  it('emits source+types only for /schema and /variables (no JS is built)', () => {
    const out = computeExports([{ name: 'button', isExperimental: false }]);
    expect(out['./button/schema']).toEqual({
      types: './dist/components/button/button.schema.d.ts',
      svelte: './src/components/button/button.schema.ts',
    });
    expect(out['./button/variables']).toEqual({
      types: './dist/components/button/button.variables.d.ts',
      svelte: './src/components/button/button.variables.ts',
    });
  });

  it('routes experimental components through the experimental dist paths', () => {
    const out = computeExports([{ name: 'lab', isExperimental: true }]);
    expect(out['./experimental/lab']).toEqual({
      types: './dist/components/experimental/lab/index.d.ts',
      svelte: './src/components/experimental/lab/index.ts',
      node: './dist/server/components/experimental/lab/index.js',
      default: './dist/components/experimental/lab/index.js',
    });
  });
});

describe('assertNoForbiddenExportKeys — generate-mode integration', () => {
  // Regression: an earlier draft of the generator only ran the guard against
  // the freshly built `next` map. That let generate mode silently drop a
  // pre-existing forbidden key (e.g. `./__debug`) during regeneration instead
  // of surfacing the violation. The guard now runs against `packageJson.exports`
  // BEFORE any filtering/preservation. This test pins the contract.
  it('throws on a pre-existing forbidden key, before any filtering', () => {
    const onDisk: Record<string, unknown> = {
      '.': {},
      './button': {},
      './__debug': { default: './dist/scratch.js' },
    };
    expect(() => assertNoForbiddenExportKeys(onDisk)).toThrow(/__debug/);
  });
});

describe('assertNoForbiddenExportKeys', () => {
  it('passes for a clean exports map', () => {
    expect(() =>
      assertNoForbiddenExportKeys({
        '.': {},
        './button': {},
        './package.json': './package.json',
      }),
    ).not.toThrow();
  });

  it.each([
    ['./__internal'],
    ['./button/__debug'],
    ['./test-helpers'],
    ['./scratch'],
    ['./temp'],
    ['./Temp'],
    ['./TEST'],
  ])('rejects forbidden key %s', (key) => {
    expect(() => assertNoForbiddenExportKeys({ [key]: {} })).toThrow(/Forbidden exports key/);
  });

  it('honors a custom pattern', () => {
    expect(() => assertNoForbiddenExportKeys({ './banned': {} }, /banned/)).toThrow();
  });

  it('exports a single source-of-truth pattern matching the documented case-insensitive set', () => {
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./__x')).toBe(true);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./TeStThing')).toBe(true);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./button')).toBe(false);
  });
});
