/**
 * Static import-boundary regression test for compose-only leaf barrels.
 *
 * Each leaf in `COMPOSE_ONLY_LEAVES` must NOT import its parent component
 * barrel, the root barrel, or another compose-only sibling in the same
 * family. This keeps the tree-shake story clean: importing `@lostgradient/cinder/tab`
 * must not transitively pull in `Tabs`, `TabList`, `TabPanel`, or anything
 * else in the parent compound family.
 *
 * Scope note: this test inspects only each leaf's `index.ts`. The `.svelte`
 * source file is allowed to read sibling context keys (e.g., `tab.svelte`
 * importing from `../tabs/tabs.svelte`) because that's how the compound
 * context flows. The guarantee here is that the *public barrel* — what a
 * consumer reaches via `@lostgradient/cinder/tab` — pulls in nothing it shouldn't.
 *
 * The test parses each leaf `index.ts` with the TypeScript compiler API and
 * inspects every `ImportDeclaration` and `ExportDeclaration` module specifier
 * — substring checks would over-match (`'../accordion-item'` contains
 * `'accordion'`, for example) so we resolve every relative specifier against
 * the file's directory and compare absolute paths.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

import { describe, expect, it } from 'bun:test';
import ts from 'typescript';

// Each entry: leaf component directory paired with the parent it belongs to.
// The parent name is used to assert the leaf never reaches into the parent
// barrel. Paths are relative to `packages/components/src/components/`.
const COMPOSE_ONLY_LEAVES: ReadonlyArray<{ leaf: string; parent: string }> = [
  { leaf: 'accordion-item', parent: 'accordion' },
  { leaf: 'tab', parent: 'tabs' },
  { leaf: 'tab-list', parent: 'tabs' },
  { leaf: 'tab-panel', parent: 'tabs' },
  { leaf: 'table-body', parent: 'table' },
  { leaf: 'table-cell', parent: 'table' },
  { leaf: 'table-header', parent: 'table' },
  { leaf: 'table-header-cell', parent: 'table' },
  { leaf: 'table-row', parent: 'table' },
  { leaf: 'dropdown-trigger', parent: 'dropdown' },
  { leaf: 'dropdown-menu', parent: 'dropdown' },
  { leaf: 'dropdown-item', parent: 'dropdown' },
  { leaf: 'dropdown-label', parent: 'dropdown' },
  { leaf: 'dropdown-separator', parent: 'dropdown' },
  { leaf: 'dropdown-group', parent: 'dropdown' },
  { leaf: 'tree-item', parent: 'tree' },
  { leaf: 'feed-event', parent: 'feed' },
  { leaf: 'grid-list-item', parent: 'grid-list' },
  { leaf: 'stat', parent: 'stat-group' },
  { leaf: 'side-navigation-group', parent: 'side-navigation' },
  { leaf: 'side-navigation-item', parent: 'side-navigation' },
];

const COMPONENTS_ROOT = resolvePath(import.meta.dir, 'components');
const ROOT_BARREL = resolvePath(import.meta.dir, 'index.ts');

/** Candidate absolute filenames a relative specifier could resolve to. */
function resolveSpecifierCandidates(fromFile: string, specifier: string): string[] {
  if (!specifier.startsWith('.')) return [];
  const base = resolvePath(dirname(fromFile), specifier);
  return [base, `${base}.ts`, resolvePath(base, 'index.ts')];
}

/** Pull every static import/export module specifier out of a TypeScript source file. */
function collectModuleSpecifiers(filePath: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

describe('compose-only leaf import boundary', () => {
  for (const { leaf, parent } of COMPOSE_ONLY_LEAVES) {
    it(`${leaf}/index.ts does not import its parent barrel, the root barrel, or a sibling leaf`, async () => {
      const leafIndexPath = resolvePath(COMPONENTS_ROOT, leaf, 'index.ts');
      expect(existsSync(leafIndexPath)).toBe(true);

      const source = await Bun.file(leafIndexPath).text();
      const specifiers = collectModuleSpecifiers(leafIndexPath, source);

      const parentBarrelCandidates = new Set([resolvePath(COMPONENTS_ROOT, parent, 'index.ts')]);
      // Sibling leaves are every other compose-only leaf in the same parent family.
      // Importing one defeats the leaf-subpath tree-shake guarantee: pulling in
      // `@lostgradient/cinder/tab` would also drag `tab-list` and `tab-panel` along.
      const siblingBarrelCandidates = new Set(
        COMPOSE_ONLY_LEAVES.filter((entry) => entry.parent === parent && entry.leaf !== leaf).map(
          (entry) => resolvePath(COMPONENTS_ROOT, entry.leaf, 'index.ts'),
        ),
      );

      for (const specifier of specifiers) {
        const candidates = resolveSpecifierCandidates(leafIndexPath, specifier);
        for (const candidate of candidates) {
          expect(
            parentBarrelCandidates.has(candidate),
            `${leaf}/index.ts imports parent barrel ${parent}/index.ts via '${specifier}'`,
          ).toBe(false);
          expect(
            candidate === ROOT_BARREL,
            `${leaf}/index.ts imports the root barrel via '${specifier}'`,
          ).toBe(false);
          expect(
            siblingBarrelCandidates.has(candidate),
            `${leaf}/index.ts imports a sibling leaf via '${specifier}' — this breaks the leaf-subpath tree-shake contract`,
          ).toBe(false);
        }
      }
    });
  }
});
