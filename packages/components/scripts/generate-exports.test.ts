/**
 * Unit tests for the exports generator. Focus areas:
 *
 *   1. Condition ordering: `types` must be first within every entry, followed
 *      by `browser`, `node`, `svelte`, `import`, `default` in that order. TypeScript
 *      `nodenext` requires `types` first; Node SSR must beat Svelte source
 *      resolution when `node` and `svelte` are active without `browser`.
 *   2. Forbidden-key guard: any exports map containing keys matching
 *      `/__|test|temp|scratch/i` must throw. CI uses this to refuse to ship
 *      debug or scratch subpaths.
 *   3. Root export shape: `.` points at the per-component-build outputs for
 *      `default` and at the shared server root for `node`.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import {
  assertNoForbiddenExportKeys,
  computeExports,
  computeFiles,
  computeRootExport,
  EXPLICIT_ROOT_FILE_ENTRIES,
  FORBIDDEN_EXPORT_KEY_PATTERN,
  legacyEntrySourcePath,
  orderedExportEntry,
  rootLevelExportTargets,
  shouldPreserveLegacyEntry,
  STATIC_FILES_GLOBS,
  stylesExport,
  stylesGuardExport,
} from './generate-exports.ts';

describe('orderedExportEntry', () => {
  it('emits keys in [types, browser, node, svelte, import, default] order regardless of input order', () => {
    const entry = orderedExportEntry({
      default: './dist/components/button/index.js',
      import: './src/components/button/index.ts',
      node: './dist/server/components/button/index.js',
      svelte: './src/components/button/index.ts',
      browser: './src/components/button/index.ts',
      types: './dist/components/button/index.d.ts',
    });
    expect(Object.keys(entry)).toEqual(['types', 'browser', 'node', 'svelte', 'import', 'default']);
  });

  it('omits missing conditions but keeps surviving keys in order', () => {
    const entry = orderedExportEntry({
      svelte: './src/components/foo/foo.schema.ts',
      import: './src/components/foo/foo.schema.ts',
      node: './dist/server/components/foo/foo.schema.js',
      browser: './src/components/foo/foo.schema.ts',
      types: './dist/components/foo/foo.schema.d.ts',
    });
    expect(Object.keys(entry)).toEqual(['types', 'browser', 'node', 'svelte', 'import']);
  });
});

describe('computeRootExport', () => {
  it('points node at the shared server root and default at the root barrel', () => {
    const root = computeRootExport();
    expect(root).toEqual({
      types: './dist/index.d.ts',
      browser: './src/index.ts',
      node: './dist/server/index.js',
      svelte: './src/index.ts',
      import: './src/index.ts',
      default: './dist/index.js',
    });
    expect(Object.keys(root)).toEqual(['types', 'browser', 'node', 'svelte', 'import', 'default']);
  });
});

describe('stylesExport', () => {
  it('emits types first, pointing at the .d.ts companion, followed by default for the CSS', () => {
    const entry = stylesExport('./src/styles/index.css');
    expect(entry).toEqual({
      types: './src/styles/index.css.d.ts',
      default: './src/styles/index.css',
    });
    expect(Object.keys(entry)).toEqual(['types', 'default']);
  });

  it('derives the .d.ts path by appending .d.ts to the css path', () => {
    expect(stylesExport('./src/styles/all.css').types).toBe('./src/styles/all.css.d.ts');
    expect(stylesExport('./src/styles/tokens.css').types).toBe('./src/styles/tokens.css.d.ts');
    expect(stylesExport('./src/styles/foundation.css').types).toBe(
      './src/styles/foundation.css.d.ts',
    );
    expect(stylesExport('./src/styles/utilities.css').types).toBe(
      './src/styles/utilities.css.d.ts',
    );
  });
});

describe('legacyEntrySourcePath', () => {
  it('prefers the svelte condition (the authored source)', () => {
    expect(
      legacyEntrySourcePath({
        types: './dist/components/timeline-item/index.d.ts',
        svelte: './src/components/timeline-item/index.ts',
        default: './dist/components/timeline-item/index.js',
      }),
    ).toBe('./src/components/timeline-item/index.ts');
  });

  it('falls back to default when svelte is absent (e.g. JSON-only entries)', () => {
    expect(
      legacyEntrySourcePath({
        import: './components.json',
        default: './components.json',
      }),
    ).toBe('./components.json');
  });

  it('returns undefined for a bare-string entry so the caller preserves it conservatively', () => {
    expect(legacyEntrySourcePath('./package.json')).toBeUndefined();
  });

  it('returns undefined when neither svelte nor default is present', () => {
    expect(legacyEntrySourcePath({ types: './dist/foo/index.d.ts' })).toBeUndefined();
  });
});

describe('shouldPreserveLegacyEntry', () => {
  // A throwaway package root holding one real source file. The existence guard
  // resolves entry source paths against this root, so we can prove it drops a
  // stale entry (source gone) and keeps a live one (source present).
  let packageRoot: string;

  beforeAll(() => {
    packageRoot = mkdtempSync(join(tmpdir(), 'cinder-exports-guard-'));
    const livePath = join(packageRoot, 'src/components/live/index.ts');
    mkdirSync(dirname(livePath), { recursive: true });
    writeFileSync(livePath, 'export {};\n');
  });

  afterAll(() => {
    rmSync(packageRoot, { recursive: true, force: true });
  });

  it('preserves a legacy entry whose on-disk source still exists', () => {
    expect(
      shouldPreserveLegacyEntry(
        { svelte: './src/components/live/index.ts', default: './dist/components/live/index.js' },
        packageRoot,
      ),
    ).toBe(true);
  });

  it('drops a legacy entry whose on-disk source is gone (hidden/renamed component)', () => {
    expect(
      shouldPreserveLegacyEntry(
        {
          svelte: './src/components/ghost/index.ts',
          default: './dist/components/ghost/index.js',
        },
        packageRoot,
      ),
    ).toBe(false);
  });

  it('preserves conservatively when the source path cannot be determined', () => {
    expect(shouldPreserveLegacyEntry('./package.json', packageRoot)).toBe(true);
    expect(shouldPreserveLegacyEntry({ types: './dist/foo/index.d.ts' }, packageRoot)).toBe(true);
  });
});

describe('computeExports', () => {
  it('emits the six-condition shape for component subpaths', () => {
    const out = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
    expect(out['./button']).toEqual({
      types: './dist/components/button/index.d.ts',
      browser: './src/components/button/index.ts',
      node: './dist/server/components/button/index.js',
      svelte: './src/components/button/index.ts',
      import: './src/components/button/index.ts',
      default: './dist/components/button/index.js',
    });
    expect(Object.keys(out['./button']!)).toEqual([
      'types',
      'browser',
      'node',
      'svelte',
      'import',
      'default',
    ]);
  });

  it('emits the six-condition runtime shape for /schema and /variables', () => {
    const out = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
    expect(out['./button/schema']).toEqual({
      types: './dist/components/button/button.schema.d.ts',
      browser: './src/components/button/button.schema.ts',
      node: './dist/server/components/button/button.schema.js',
      svelte: './src/components/button/button.schema.ts',
      import: './src/components/button/button.schema.ts',
      default: './dist/components/button/button.schema.js',
    });
    expect(out['./button/variables']).toEqual({
      types: './dist/components/button/button.variables.d.ts',
      browser: './src/components/button/button.variables.ts',
      node: './dist/server/components/button/button.variables.js',
      svelte: './src/components/button/button.variables.ts',
      import: './src/components/button/button.variables.ts',
      default: './dist/components/button/button.variables.js',
    });
  });

  // Task 4176c51c: schema/variables are runtime entry points. The build compiles
  // each `<name>.schema.ts` / `<name>.variables.ts` to its own JS, so a plain
  // Node/Vite consumer resolving `@lostgradient/cinder/<name>/schema` under the `default`
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
      // Full six-condition shape in the canonical order.
      expect(Object.keys(entry)).toEqual([
        'types',
        'browser',
        'node',
        'svelte',
        'import',
        'default',
      ]);
    }
  });

  it('routes experimental components through the experimental dist paths', () => {
    const out = computeExports([{ name: 'lab', isExperimental: true, hasCss: false }]);
    expect(out['./experimental/lab']).toEqual({
      types: './dist/components/experimental/lab/index.d.ts',
      browser: './src/components/experimental/lab/index.ts',
      node: './dist/server/components/experimental/lab/index.js',
      svelte: './src/components/experimental/lab/index.ts',
      import: './src/components/experimental/lab/index.ts',
      default: './dist/components/experimental/lab/index.js',
    });
  });

  it('emits a types+default /styles sidecar export only when hasCss is true', () => {
    const withCss = computeExports([{ name: 'button', isExperimental: false, hasCss: true }]);
    // Per-component /styles subpaths carry a side-effect type stub companion.
    expect(withCss['./button/styles']).toEqual({
      types: './dist/components/button/button.css.d.ts',
      default: './dist/components/button/button.css',
    });
    expect(Object.keys(withCss['./button/styles']!)).toEqual(['types', 'default']);

    const withoutCss = computeExports([{ name: 'button', isExperimental: false, hasCss: false }]);
    expect(withoutCss['./button/styles']).toBeUndefined();
  });

  it('routes experimental /styles sidecars through the experimental dist path', () => {
    const out = computeExports([{ name: 'lab', isExperimental: true, hasCss: true }]);
    expect(out['./experimental/lab/styles']).toEqual({
      types: './dist/components/experimental/lab/lab.css.d.ts',
      default: './dist/components/experimental/lab/lab.css',
    });
  });
});

describe('stylesGuardExport', () => {
  it('emits a six-condition entry pointing at the base-guard module', () => {
    const entry = stylesGuardExport();
    expect(entry).toEqual({
      types: './dist/styles/base-guard.d.ts',
      browser: './src/styles/base-guard.ts',
      node: './dist/server/styles/base-guard.js',
      svelte: './src/styles/base-guard.ts',
      import: './src/styles/base-guard.ts',
      default: './dist/styles/base-guard.js',
    });
    expect(Object.keys(entry)).toEqual(['types', 'browser', 'node', 'svelte', 'import', 'default']);
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

  it('includes the src/styles/**/*.css.d.ts glob so reserved style type stubs are published', () => {
    // The type stubs for reserved CSS subpaths live in src/styles/ alongside the
    // CSS sources. Without this glob they would not be included in the published
    // tarball, making the `types` condition in every ./styles* subpath point at a
    // missing file for consumers.
    expect(STATIC_FILES_GLOBS).toContain('src/styles/**/*.css.d.ts');
  });
});
