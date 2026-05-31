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
  computeFiles,
  computeRootExport,
  EXPLICIT_ROOT_FILE_ENTRIES,
  FORBIDDEN_EXPORT_KEY_PATTERN,
  orderedExportEntry,
  rootLevelExportTargets,
  STATIC_FILES_GLOBS,
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

  it('emits the four-condition runtime shape for /schema and /variables', () => {
    const out = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
    expect(out['./button/schema']).toEqual({
      types: './dist/components/button/button.schema.d.ts',
      svelte: './src/components/button/button.schema.ts',
      node: './dist/server/components/button/button.schema.js',
      default: './dist/components/button/button.schema.js',
    });
    expect(out['./button/variables']).toEqual({
      types: './dist/components/button/button.variables.d.ts',
      svelte: './src/components/button/button.variables.ts',
      node: './dist/server/components/button/button.variables.js',
      default: './dist/components/button/button.variables.js',
    });
  });

  // Task 4176c51c: schema/variables are runtime entry points. The build compiles
  // each `<name>.schema.ts` / `<name>.variables.ts` to its own JS, so a plain
  // Node/Vite consumer resolving `cinder/<name>/schema` under the `default`
  // condition gets a real module — no ERR_PACKAGE_PATH_NOT_EXPORTED. This test
  // pins the `default` (and `node`) condition at the generator so a regression
  // that drops the runtime condition is caught before it ships. The
  // manifest-consumer fixture asserts the same at Node runtime.
  it('emits a default (and node) runtime condition on every /schema and /variables export', () => {
    const out = computeExports([
      { name: 'button', isExperimental: false, hasCss: false },
      { name: 'lab', isExperimental: true, hasCss: false },
    ]);
    const metadataKeys = Object.keys(out).filter(
      (key) => key.endsWith('/schema') || key.endsWith('/variables'),
    );
    expect(metadataKeys.length).toBeGreaterThan(0);
    for (const key of metadataKeys) {
      const entry = out[key]!;
      expect(entry).toHaveProperty('default');
      expect(entry).toHaveProperty('node');
      // Full four-condition shape in the canonical order.
      expect(Object.keys(entry)).toEqual(['types', 'svelte', 'node', 'default']);
    }
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

describe('rootLevelExportTargets', () => {
  it('collects root-level artifact targets and excludes package.json', () => {
    const targets = rootLevelExportTargets({
      '.': { default: './dist/index.js' },
      './manifest': { import: './components.json', default: './components.json' },
      './package.json': './package.json',
      './button/styles': { default: './dist/components/button/button.css' },
      './styles': { default: './src/styles/index.css' },
    });
    expect(targets.toSorted()).toEqual(['components.json']);
  });

  it('ignores non-root and non-relative targets', () => {
    const targets = rootLevelExportTargets({
      './button': {
        types: './dist/components/button/index.d.ts',
        default: './dist/components/button/index.js',
      },
    });
    // Every target has a directory segment, so nothing is root-level.
    expect(targets).toEqual([]);
  });
});

describe('computeFiles', () => {
  const exportsWithManifest = {
    './manifest': { import: './components.json', default: './components.json' },
    './package.json': './package.json',
  };

  it('keeps the static globs verbatim and in order at the front', () => {
    const files = computeFiles(exportsWithManifest);
    expect(files.slice(0, STATIC_FILES_GLOBS.length)).toEqual([...STATIC_FILES_GLOBS]);
  });

  it('appends both explicit root JSON entries', () => {
    const files = computeFiles(exportsWithManifest);
    expect(files).toContain('components.json');
    expect(files).toContain('examples-exclusions.json');
  });

  it('appends computed root entries alphabetically after the static globs', () => {
    const files = computeFiles(exportsWithManifest);
    const appended = files.slice(STATIC_FILES_GLOBS.length);
    // explicit entries: components.json, examples-exclusions.json — already sorted.
    expect(appended).toEqual(['components.json', 'examples-exclusions.json']);
  });

  it('dedupes a root export target that also appears in the explicit entries', () => {
    // `components.json` is both an explicit entry AND a root-level export target.
    const files = computeFiles(exportsWithManifest);
    const occurrences = files.filter((entry) => entry === 'components.json');
    expect(occurrences).toHaveLength(1);
  });

  it('does not flatten into explicit per-component paths', () => {
    const files = computeFiles(exportsWithManifest);
    // No entry should reference a concrete component directory path.
    expect(files.some((entry) => entry.startsWith('dist/components/'))).toBe(false);
    expect(files.some((entry) => entry.startsWith('src/components/accordion'))).toBe(false);
  });

  it('includes a new root-level artifact the exports reference but the globs do not cover', () => {
    const files = computeFiles(
      {
        ...exportsWithManifest,
        './extra': { import: './extra-artifact.json', default: './extra-artifact.json' },
      },
      STATIC_FILES_GLOBS,
      EXPLICIT_ROOT_FILE_ENTRIES,
    );
    const appended = files.slice(STATIC_FILES_GLOBS.length);
    expect(appended).toEqual([
      'components.json',
      'examples-exclusions.json',
      'extra-artifact.json',
    ]);
  });

  it('does not duplicate a root artifact already covered by a static glob', () => {
    const files = computeFiles({ './foo': { default: './foo.json' } }, ['dist', 'foo.json'], []);
    expect(files.filter((entry) => entry === 'foo.json')).toHaveLength(1);
  });
});
