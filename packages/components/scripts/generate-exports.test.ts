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
  stylesGuardExport,
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
    const out = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
    expect(out['./button']).toEqual({
      types: './dist/components/button/index.d.ts',
      svelte: './src/components/button/index.ts',
      node: './dist/server/components/button/index.js',
      default: './dist/components/button/index.js',
    });
    expect(Object.keys(out['./button']!)).toEqual(['types', 'svelte', 'node', 'default']);
  });

  it('emits source+types only for /schema and /variables (no JS is built)', () => {
    const out = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
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
    const out = computeExports([{ name: 'lab', isExperimental: true, hasCss: false }]);
    expect(out['./experimental/lab']).toEqual({
      types: './dist/components/experimental/lab/index.d.ts',
      svelte: './src/components/experimental/lab/index.ts',
      node: './dist/server/components/experimental/lab/index.js',
      default: './dist/components/experimental/lab/index.js',
    });
  });

  it('emits a default-only /styles sidecar export only when hasCss is true', () => {
    const withCss = computeExports([{ name: 'button', isExperimental: false, hasCss: true }]);
    expect(withCss['./button/styles']).toEqual({
      default: './dist/components/button/button.css',
    });

    const withoutCss = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
    expect(withoutCss['./button/styles']).toBeUndefined();
  });

  it('routes experimental /styles sidecars through the experimental dist path', () => {
    const out = computeExports([{ name: 'lab', isExperimental: true, hasCss: true }]);
    expect(out['./experimental/lab/styles']).toEqual({
      default: './dist/components/experimental/lab/lab.css',
    });
  });
});

describe('stylesGuardExport', () => {
  it('emits a four-condition entry pointing at the base-guard module', () => {
    const entry = stylesGuardExport();
    expect(entry).toEqual({
      types: './dist/styles/base-guard.d.ts',
      svelte: './src/styles/base-guard.ts',
      node: './dist/server/styles/base-guard.js',
      default: './dist/styles/base-guard.js',
    });
    expect(Object.keys(entry)).toEqual(['types', 'svelte', 'node', 'default']);
  });

  it('is not affected by the component discovery list (it is a reserved entry)', () => {
    // The guard entry is stitched in by the generator's reserved-key path,
    // not by computeExports — so computeExports must NOT emit it.
    const computed = computeExports([{ name: 'styles', isExperimental: false, hasCss: false }]);
    // A component named 'styles' would produce './styles', but the guard key
    // './styles/guard' must never appear in the computed component subpaths.
    expect(computed['./styles/guard']).toBeUndefined();
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
    // Forbidden: path-segment anchored matches.
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./__x')).toBe(true);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./test')).toBe(true);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./Temp')).toBe(true);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./test-helpers')).toBe(true);
    // Permitted: legitimate component names that merely contain the substring.
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./button')).toBe(false);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./template')).toBe(false);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./temporal')).toBe(false);
    expect(FORBIDDEN_EXPORT_KEY_PATTERN.test('./testament')).toBe(false);
  });
});
