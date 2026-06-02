import { describe, expect, it } from 'bun:test';

import {
  assertNoAmbiguousImports,
  assertNoUnmodellableImports,
  buildImportGraph,
  computeScope,
  dependentsClosure,
  extractImports,
  loadKnownSlugs,
  loadSourceFiles,
  pathForceFullReason,
  resolveImport,
  slugForFile,
  UNMODELLABLE_IMPORT_ALLOWLIST,
  type ComputeScopeOptions,
} from './component-graph.ts';

// ---------------------------------------------------------------------------
// extractImports
// ---------------------------------------------------------------------------

describe('extractImports', () => {
  it('extracts default, named, and type imports', () => {
    const content = `
      import Button from '../button/button.svelte';
      import { foo } from '../../utilities/foo.ts';
      import type { Bar } from './bar.ts';
    `;
    const { specifiers, hasUnmodellableImport } = extractImports(content);
    expect(specifiers.toSorted()).toEqual([
      '../../utilities/foo.ts',
      '../button/button.svelte',
      './bar.ts',
    ]);
    expect(hasUnmodellableImport).toBe(false);
  });

  it('extracts side-effect imports', () => {
    const { specifiers } = extractImports(`import './styles.css';`);
    expect(specifiers).toEqual(['./styles.css']);
  });

  it('extracts export … from and export * from re-exports', () => {
    const content = `
      export { Thing } from './thing.ts';
      export * from './all.ts';
      export type { T } from './types.ts';
      export * as ns from './ns.ts';
    `;
    expect(extractImports(content).specifiers.toSorted()).toEqual([
      './all.ts',
      './ns.ts',
      './thing.ts',
      './types.ts',
    ]);
  });

  it('extracts MULTILINE import clauses (Prettier output)', () => {
    const content = `
      import {
        A,
        B,
      } from './foo.ts';
      import Button, {
        type ButtonProps,
      } from './button.ts';
      export {
        x as y,
      } from './bar.ts';
    `;
    expect(extractImports(content).specifiers.toSorted()).toEqual([
      './bar.ts',
      './button.ts',
      './foo.ts',
    ]);
  });

  it('extracts an import in a single-line svelte <script> tag', () => {
    expect(extractImports(`<script>import Foo from './foo.ts';</script>`).specifiers).toEqual([
      './foo.ts',
    ]);
  });

  it('flags a computed dynamic import even with a comment before the paren', () => {
    expect(extractImports('await import /* c */ (specifier);').hasUnmodellableImport).toBe(true);
  });

  it('flags TS 5.5 string-literal specifier-name imports as unmodellable', () => {
    // The quote inside the clause defeats the static pattern, so force full
    // rather than silently drop the edge.
    expect(extractImports(`import { "x-y" as z } from './foo.ts';`).hasUnmodellableImport).toBe(
      true,
    );
    expect(extractImports(`export { a as "b-c" } from './bar.ts';`).hasUnmodellableImport).toBe(
      true,
    );
    // A plain string elsewhere must NOT trip the guard.
    expect(
      extractImports(`import { A } from './a.ts';\nconst s = 'hi from there';`)
        .hasUnmodellableImport,
    ).toBe(false);
  });

  it('extracts string-literal dynamic imports as edges', () => {
    const { specifiers, hasUnmodellableImport } = extractImports(
      `const m = await import('./lazy.ts');`,
    );
    expect(specifiers).toEqual(['./lazy.ts']);
    expect(hasUnmodellableImport).toBe(false);
  });

  it('flags computed dynamic imports as unmodellable', () => {
    const { specifiers, hasUnmodellableImport } = extractImports(
      `const m = await import(componentPath);`,
    );
    expect(specifiers).toEqual([]);
    expect(hasUnmodellableImport).toBe(true);
  });

  it('flags template-literal dynamic imports as unmodellable', () => {
    expect(extractImports('await import(`./pages/${name}.ts`);').hasUnmodellableImport).toBe(true);
  });

  it('does not treat import.meta as a dynamic import', () => {
    const { hasUnmodellableImport, specifiers } = extractImports(
      `const u = import.meta.url; import x from './x.ts';`,
    );
    expect(hasUnmodellableImport).toBe(false);
    expect(specifiers).toEqual(['./x.ts']);
  });

  it('extracts imports from inside svelte <script> blocks', () => {
    const content = `
      <script lang="ts">
        import Button from '../button/button.svelte';
      </script>
      <div>markup</div>
    `;
    expect(extractImports(content).specifiers).toEqual(['../button/button.svelte']);
  });
});

// ---------------------------------------------------------------------------
// resolveImport
// ---------------------------------------------------------------------------

describe('resolveImport', () => {
  const from = 'packages/components/src/components/dialog/dialog.svelte';

  it('treats bare specifiers as external', () => {
    const exists = () => true;
    expect(resolveImport(from, 'zod', exists).kind).toBe('external');
    expect(resolveImport(from, '@cinder/markdown', exists).kind).toBe('external');
    expect(resolveImport(from, 'svelte', exists).kind).toBe('external');
  });

  it('resolves an explicit .svelte specifier', () => {
    const target = 'packages/components/src/components/button/button.svelte';
    const result = resolveImport(from, '../button/button.svelte', (p) => p === target);
    expect(result).toEqual({ kind: 'resolved', path: target });
  });

  it('rewrites .js specifiers to .ts on disk', () => {
    const fromTs = 'packages/components/src/components/chat/input/chat-input.svelte';
    const target = 'packages/components/src/components/chat/input/attachment-kind.ts';
    const result = resolveImport(fromTs, './attachment-kind.js', (p) => p === target);
    expect(result).toEqual({ kind: 'resolved', path: target });
  });

  it('resolves an extensionless specifier to <base>.ts', () => {
    const target = 'packages/components/src/schema-types.ts';
    const fromUtil = 'packages/components/src/components/button/button.types.ts';
    const result = resolveImport(fromUtil, '../../schema-types', (p) => p === target);
    expect(result).toEqual({ kind: 'resolved', path: target });
  });

  it('resolves an extensionless directory specifier to index.ts', () => {
    const target = 'packages/components/src/components/dropdown/index.ts';
    const result = resolveImport(from, '../dropdown', (p) => p === target);
    expect(result).toEqual({ kind: 'resolved', path: target });
  });

  it('returns ambiguous when both foo.svelte and foo.svelte.ts exist', () => {
    const a = 'packages/components/src/components/x/foo.svelte';
    const b = 'packages/components/src/components/x/foo.svelte.ts';
    const fromX = 'packages/components/src/components/x/x.svelte';
    const result = resolveImport(fromX, './foo', (p) => p === a || p === b);
    expect(result.kind).toBe('ambiguous');
  });

  it('rewrites .mjs specifiers to .mts on disk', () => {
    const target = 'packages/components/src/utilities/helpers.mts';
    const result = resolveImport(from, '../../utilities/helpers.mjs', (p) => p === target);
    expect(result).toEqual({ kind: 'resolved', path: target });
  });

  it('resolves an explicit .svelte.ts specifier as-is (compound extension)', () => {
    const target = 'packages/components/src/utilities/use-history.svelte.ts';
    const result = resolveImport(
      from,
      '../../utilities/use-history.svelte.ts',
      (p) => p === target,
    );
    expect(result).toEqual({ kind: 'resolved', path: target });
  });

  it('returns external when nothing resolves on disk', () => {
    expect(resolveImport(from, './does-not-exist', () => false).kind).toBe('external');
  });
});

// ---------------------------------------------------------------------------
// slugForFile
// ---------------------------------------------------------------------------

describe('slugForFile', () => {
  it('maps a top-level component file to its slug', () => {
    expect(slugForFile('packages/components/src/components/button/button.svelte')).toBe('button');
  });

  it('maps a nested subdirectory file to its top-level slug', () => {
    expect(slugForFile('packages/components/src/components/chat/input/chat-input.svelte')).toBe(
      'chat',
    );
  });

  it('returns null for _internal and underscore files', () => {
    expect(slugForFile('packages/components/src/components/_internal/focus.ts')).toBeNull();
    expect(slugForFile('packages/components/src/components/_sortable-item.svelte')).toBeNull();
  });

  it('returns null for a bare file directly under components/', () => {
    expect(slugForFile('packages/components/src/components/chart.types.ts')).toBeNull();
  });

  it('returns null for shared utilities and sibling packages', () => {
    expect(slugForFile('packages/components/src/utilities/class-names.ts')).toBeNull();
    expect(slugForFile('packages/editor/src/index.ts')).toBeNull();
  });

  it('returns null for experimental deprecation-alias shims', () => {
    // `experimental/<name>/index.ts` re-exports the promoted top-level component;
    // it is not a slug of its own (no .svelte, no test suite).
    expect(
      slugForFile('packages/components/src/components/experimental/timeline/index.ts'),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// graph + dependents closure
// ---------------------------------------------------------------------------

describe('buildImportGraph + dependentsClosure', () => {
  const C = 'packages/components/src/components';
  const U = 'packages/components/src/utilities';

  const files = new Map<string, string>([
    [`${C}/button/button.svelte`, `import { cx } from '../../utilities/class-names.ts';`],
    [`${C}/dialog/dialog.svelte`, `import Button from '../button/button.svelte';`],
    [`${C}/confirm-dialog/confirm-dialog.svelte`, `import Dialog from '../dialog/dialog.svelte';`],
    [`${C}/unrelated/unrelated.svelte`, `import { cx } from '../../utilities/class-names.ts';`],
    [`${U}/class-names.ts`, `export const cx = () => '';`],
  ]);

  it('builds forward and reverse edges', () => {
    const graph = buildImportGraph(files);
    expect(graph.forward.get(`${C}/dialog/dialog.svelte`)).toContain(`${C}/button/button.svelte`);
    expect(graph.reverse.get(`${C}/button/button.svelte`)).toContain(`${C}/dialog/dialog.svelte`);
  });

  it('computes the transitive dependents closure', () => {
    const graph = buildImportGraph(files);
    const closure = dependentsClosure(graph, [`${C}/button/button.svelte`]);
    // button → dialog → confirm-dialog
    expect(closure).toContain(`${C}/button/button.svelte`);
    expect(closure).toContain(`${C}/dialog/dialog.svelte`);
    expect(closure).toContain(`${C}/confirm-dialog/confirm-dialog.svelte`);
    expect(closure).not.toContain(`${C}/unrelated/unrelated.svelte`);
  });

  it('fans a shared utility out to every importer', () => {
    const graph = buildImportGraph(files);
    const closure = dependentsClosure(graph, [`${U}/class-names.ts`]);
    expect(closure).toContain(`${C}/button/button.svelte`);
    expect(closure).toContain(`${C}/unrelated/unrelated.svelte`);
    // and transitively button's dependents
    expect(closure).toContain(`${C}/dialog/dialog.svelte`);
  });

  it('terminates on import cycles', () => {
    const cyclic = new Map<string, string>([
      [`${C}/a/a.svelte`, `import B from '../b/b.svelte';`],
      [`${C}/b/b.svelte`, `import A from '../a/a.svelte';`],
    ]);
    const graph = buildImportGraph(cyclic);
    const closure = dependentsClosure(graph, [`${C}/a/a.svelte`]);
    expect(closure).toEqual(new Set([`${C}/a/a.svelte`, `${C}/b/b.svelte`]));
  });
});

// ---------------------------------------------------------------------------
// pathForceFullReason (golden per category)
// ---------------------------------------------------------------------------

describe('pathForceFullReason', () => {
  it('forces full for testing-harness changes', () => {
    expect(pathForceFullReason('packages/testing/playwright.config.ts')).not.toBeNull();
    expect(pathForceFullReason('packages/testing/src/helpers/screenshot.ts')).not.toBeNull();
  });

  it('allow-lists only the README inside testing; the scope script forces full', () => {
    expect(pathForceFullReason('packages/testing/README.md')).toBeNull();
    // The scope script itself force-fulls — a scoper bug must not under-test its own PR.
    expect(pathForceFullReason('packages/testing/scripts/changed-components.ts')).not.toBeNull();
  });

  it('forces full for lockfile, root manifest, and tsconfig', () => {
    expect(pathForceFullReason('bun.lock')).not.toBeNull();
    expect(pathForceFullReason('package.json')).not.toBeNull();
    expect(pathForceFullReason('tsconfig.base.json')).not.toBeNull();
    expect(pathForceFullReason('packages/components/tsconfig.json')).not.toBeNull();
  });

  it('forces full for any script change, including the scope scripts', () => {
    expect(pathForceFullReason('packages/components/scripts/build.ts')).not.toBeNull();
    expect(pathForceFullReason('packages/components/scripts/generate-exports.ts')).not.toBeNull();
    // The scope scripts themselves force full — a scoper bug must not be able to
    // under-test the PR that introduced it.
    expect(pathForceFullReason('packages/components/scripts/component-graph.ts')).not.toBeNull();
    expect(pathForceFullReason('packages/components/scripts/test-changed.ts')).not.toBeNull();
    expect(pathForceFullReason('packages/testing/scripts/changed-components.ts')).not.toBeNull();
  });

  it('forces full for global styles', () => {
    expect(pathForceFullReason('packages/components/src/styles/tokens.css')).not.toBeNull();
  });

  it('forces full for any workflow change, including browser-tests itself', () => {
    expect(pathForceFullReason('.github/workflows/main-green.yaml')).not.toBeNull();
    // A browser-tests.yaml edit can change which tests run / how the scoper is
    // invoked, so it force-fulls too — no self-edit exception.
    expect(pathForceFullReason('.github/workflows/browser-tests.yaml')).not.toBeNull();
  });

  it('forces full for runtime config and per-package manifests', () => {
    expect(pathForceFullReason('bun.lockb')).not.toBeNull();
    expect(pathForceFullReason('bunfig.toml')).not.toBeNull();
    expect(pathForceFullReason('.npmrc')).not.toBeNull();
    expect(pathForceFullReason('packages/editor/package.json')).not.toBeNull();
    expect(pathForceFullReason('packages/markdown/package.json')).not.toBeNull();
  });

  it('returns null for an ordinary component source file', () => {
    expect(
      pathForceFullReason('packages/components/src/components/button/button.svelte'),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeScope (the composed decision)
// ---------------------------------------------------------------------------

describe('computeScope', () => {
  const C = 'packages/components/src/components';
  const U = 'packages/components/src/utilities';

  const sourceFiles = new Map<string, string>([
    [`${C}/button/button.svelte`, `import { cx } from '../../utilities/class-names.ts';`],
    [`${C}/dialog/dialog.svelte`, `import Button from '../button/button.svelte';`],
    [`${C}/badge/badge.svelte`, `export let label = '';`],
    [`${U}/class-names.ts`, `export const cx = () => '';`],
  ]);
  const knownSlugs = new Set(['button', 'dialog', 'badge']);

  const base = (overrides: Partial<ComputeScopeOptions>): ComputeScopeOptions => ({
    changedFiles: [],
    sourceFiles,
    knownSlugs,
    ...overrides,
  });

  it('filters to a single component and its dependents', () => {
    const decision = computeScope(base({ changedFiles: [`${C}/button/button.svelte`] }));
    expect(decision).toEqual({ mode: 'filtered', slugs: ['button', 'dialog'] });
  });

  it('filters to just the leaf when nothing depends on it', () => {
    const decision = computeScope(base({ changedFiles: [`${C}/badge/badge.svelte`] }));
    expect(decision).toEqual({ mode: 'filtered', slugs: ['badge'] });
  });

  it('fans a shared utility out to all dependents', () => {
    const decision = computeScope(base({ changedFiles: [`${U}/class-names.ts`] }));
    expect(decision).toEqual({ mode: 'filtered', slugs: ['button', 'dialog'] });
  });

  it('forces full on a path-based trigger', () => {
    const decision = computeScope(base({ changedFiles: ['bun.lock'] }));
    expect(decision.mode).toBe('full');
  });

  it('forces full on a deleted file', () => {
    const decision = computeScope(
      base({
        changedFiles: [`${C}/button/button.svelte`],
        deletedFiles: [`${C}/old/old.svelte`],
      }),
    );
    expect(decision.mode).toBe('full');
  });

  it('forces full when an unmodellable import exists outside the allow-list', () => {
    const poisoned = new Map(sourceFiles);
    poisoned.set(`${C}/lazy/lazy.svelte`, `const m = await import(dynamicPath);`);
    const decision = computeScope(
      base({ sourceFiles: poisoned, changedFiles: [`${C}/badge/badge.svelte`] }),
    );
    expect(decision.mode).toBe('full');
    expect((decision as { reason: string }).reason).toContain('computed dynamic import');
  });

  it('forces full when a changed file resolves to no known slug and is not shared', () => {
    const withBareFile = new Map(sourceFiles);
    withBareFile.set(`${C}/chart.types.ts`, `export type Chart = unknown;`);
    const decision = computeScope(
      base({ sourceFiles: withBareFile, changedFiles: [`${C}/chart.types.ts`] }),
    );
    expect(decision.mode).toBe('full');
  });

  it('forces full when the closure reaches an unknown slug', () => {
    const decision = computeScope(
      base({ changedFiles: [`${C}/button/button.svelte`], knownSlugs: new Set(['button']) }),
    );
    // dialog is in the closure but not in knownSlugs
    expect(decision.mode).toBe('full');
  });

  it('forces full when no source files changed', () => {
    const decision = computeScope(base({ changedFiles: ['docs/readme.md'] }));
    expect(decision.mode).toBe('full');
  });

  it('uses the EXACT "no component-mapped changes detected" reason (decide() depends on it)', () => {
    // changed-components.ts decide() string-matches this reason to let an
    // example-only change recover a filtered scope. Pin the wording so a rename
    // fails here loudly instead of silently breaking that rescue path.
    const decision = computeScope(base({ changedFiles: ['docs/readme.md'] }));
    expect(decision).toEqual({ mode: 'full', reason: 'no component-mapped changes detected' });
  });

  // --- silent-miss regressions (found by codex-advisor) ---

  it('includes a co-changed test file’s slug even when another component also changed', () => {
    // button.test.ts is not in the graph, but a change to it must still run
    // button's tests — even when badge.svelte is co-changed and "wins" the graph.
    const decision = computeScope(
      base({ changedFiles: [`${C}/button/button.test.ts`, `${C}/badge/badge.svelte`] }),
    );
    expect(decision.mode).toBe('filtered');
    if (decision.mode === 'filtered') {
      expect(decision.slugs).toContain('button');
      expect(decision.slugs).toContain('badge');
    }
  });

  it('forces full when an unaccounted file is co-changed with a component', () => {
    // A non-source, non-force-full, non-example file must not be silently dropped
    // just because a co-changed component produced a slug.
    const decision = computeScope(
      base({ changedFiles: [`${C}/badge/badge.svelte`, 'some/random/asset.bin'] }),
    );
    expect(decision.mode).toBe('full');
    expect((decision as { reason: string }).reason).toContain('unaccounted');
  });

  it('ignores docs/markdown co-changes (does not force full)', () => {
    // A README or doc co-changed with a component is harmless — scope to the
    // component, do not force full.
    const decision = computeScope(
      base({
        changedFiles: [`${C}/badge/badge.svelte`, `${C}/badge/README.md`, 'docs/guide.md'],
      }),
    );
    expect(decision).toEqual({ mode: 'filtered', slugs: ['badge'] });
  });

  it('maps a non-graph component sidecar (CSS) to its slug', () => {
    const decision = computeScope(base({ changedFiles: [`${C}/badge/badge.css`] }));
    expect(decision).toEqual({ mode: 'filtered', slugs: ['badge'] });
  });

  it('force-fulls a shared seed that reaches no component, even with a co-changed component', () => {
    // packages/markdown/src/foo.ts is a traceable shared module, but no component
    // in the graph imports it (markdown is consumed via bare `cinder/markdown/...`
    // specifiers → external → no edge). Co-changed with badge, the naive result
    // would be filtered: [badge], silently dropping the markdown change. The
    // per-seed reachability guard must force full instead. (copilot finding, PR #222)
    const withMarkdown = new Map(sourceFiles);
    withMarkdown.set('packages/markdown/src/foo.ts', `export const foo = 1;`);
    const decision = computeScope(
      base({
        sourceFiles: withMarkdown,
        changedFiles: ['packages/markdown/src/foo.ts', `${C}/badge/badge.svelte`],
      }),
    );
    expect(decision.mode).toBe('full');
    expect((decision as { reason: string }).reason).toContain('reaches no standalone component');
  });

  it('keeps filtered when a shared seed DOES reach a component', () => {
    // class-names.ts is imported by button → its closure reaches a component, so
    // a shared change that genuinely fans out stays filtered (not over-fulled).
    const decision = computeScope(base({ changedFiles: [`${U}/class-names.ts`] }));
    expect(decision.mode).toBe('filtered');
    if (decision.mode === 'filtered') {
      expect(decision.slugs).toContain('button');
    }
  });

  it('force-fulls globally when ANY ambiguous import exists in the graph', () => {
    // card imports '../button/button' (extensionless); both button.ts and
    // button.svelte exist → ambiguous. Any ambiguous import in the scanned graph
    // forces full (the closure could be incomplete), even when the changed file
    // is unrelated to it.
    const ambiguous = new Map<string, string>([
      [`${C}/button/button.ts`, `export const x = 1;`],
      [`${C}/button/button.svelte`, `<script>export let y = 1;</script>`],
      [`${C}/card/card.svelte`, `<script>import Button from '../button/button';</script>`],
      [`${C}/badge/badge.svelte`, `<script>let z = 1;</script>`],
    ]);
    const decision = computeScope({
      changedFiles: [`${C}/badge/badge.svelte`], // unrelated to the ambiguous import
      sourceFiles: ambiguous,
      knownSlugs: new Set(['button', 'card', 'badge']),
    });
    expect(decision.mode).toBe('full');
    expect((decision as { reason: string }).reason).toContain('ambiguous');
  });

  it('force-fulls when the shared test harness (src/test) changes', () => {
    const decision = computeScope(
      base({
        changedFiles: ['packages/components/src/test/lifecycle.ts', `${C}/badge/badge.svelte`],
      }),
    );
    expect(decision.mode).toBe('full');
    expect((decision as { reason: string }).reason).toContain('test-harness');
  });
});

// ---------------------------------------------------------------------------
// Guard against the real tree
// ---------------------------------------------------------------------------

describe('no-unmodellable-imports guard (real tree)', () => {
  it('the harness allow-list is exhaustive — no stray computed imports', async () => {
    const files = await loadSourceFiles();
    expect(() => assertNoUnmodellableImports(files)).not.toThrow();
  });

  it('the real tree has no ambiguous imports that would make scoping permanently full', async () => {
    const files = await loadSourceFiles();
    expect(() => assertNoAmbiguousImports(files)).not.toThrow();
  });

  it('every allow-list entry is under src/test/ (cannot wave through component source)', () => {
    for (const entry of UNMODELLABLE_IMPORT_ALLOWLIST) {
      expect(entry.startsWith('packages/components/src/test/')).toBe(true);
    }
  });

  it('discovers a sane number of component slugs', async () => {
    const slugs = await loadKnownSlugs();
    // Sanity floor: the library has well over 100 components.
    expect(slugs.size).toBeGreaterThan(100);
    expect(slugs.has('button')).toBe(true);
    expect(slugs.has('confirm-dialog')).toBe(true);
  });

  it('a real button change scopes to button + its real dependents', async () => {
    const sourceFiles = await loadSourceFiles();
    const knownSlugs = await loadKnownSlugs();
    const decision = computeScope({
      changedFiles: ['packages/components/src/components/button/button.svelte'],
      sourceFiles,
      knownSlugs,
    });
    expect(decision.mode).toBe('filtered');
    if (decision.mode === 'filtered') {
      expect(decision.slugs).toContain('button');
      // alert-dialog and confirm-dialog import button — verified in the tree.
      expect(decision.slugs).toContain('confirm-dialog');
      expect(decision.slugs).toContain('alert-dialog');
    }
  });

  it('a widely-imported utility fans out to (real) slugs, not full-on-alias', async () => {
    // class-names.ts is imported across the library; its closure reaches the
    // `experimental/*` deprecation aliases. Those must map to null (not an
    // unknown `experimental` slug that would force full).
    const sourceFiles = await loadSourceFiles();
    const knownSlugs = await loadKnownSlugs();
    const decision = computeScope({
      changedFiles: ['packages/components/src/utilities/class-names.ts'],
      sourceFiles,
      knownSlugs,
    });
    expect(decision.mode).toBe('filtered');
    if (decision.mode === 'filtered') {
      expect(decision.slugs.length).toBeGreaterThan(50);
      // every returned slug is a real, known component
      for (const slug of decision.slugs) expect(knownSlugs.has(slug)).toBe(true);
    }
  });
});
