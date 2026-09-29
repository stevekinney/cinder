import { describe, expect, it } from 'bun:test';

import {
  arbitraryExtensionDeclarationPath,
  findExtensionlessDeclarationSpecifiers,
  findMatchingReexportPath,
  findRelativeSpecifiers,
  findSelfReferentialTypeImports,
  findUnresolvedArbitraryExtensionImports,
  findUnresolvedRelativeImports,
  isArbitraryExtensionSpecifier,
  requiresDistMaterialization,
} from './dist-relative-imports.ts';

describe('findRelativeSpecifiers', () => {
  it('finds a static named import specifier', () => {
    expect(
      findRelativeSpecifiers("import buttonConstraints from '../components/button/x.json';"),
    ).toEqual(['../components/button/x.json']);
  });

  it('finds a re-export specifier', () => {
    expect(findRelativeSpecifiers("export { default as Button } from './button.js';")).toEqual([
      './button.js',
    ]);
  });

  it('finds a dynamic import specifier', () => {
    expect(findRelativeSpecifiers("const m = import('./lazy.js');")).toEqual(['./lazy.js']);
  });

  it('ignores a bare specifier with no leading ./ or ../', () => {
    expect(findRelativeSpecifiers("import { z } from 'zod';")).toEqual([]);
  });

  it('ignores a bare side-effect import with no from clause', () => {
    expect(findRelativeSpecifiers("import './styles/index.css';")).toEqual([]);
  });

  it('finds every specifier across multiple statements', () => {
    expect(
      findRelativeSpecifiers(
        [
          "import a from '../a.json';",
          "export { b } from './b.js';",
          "export * from './c.ts';",
        ].join('\n'),
      ),
    ).toEqual(['../a.json', './b.js', './c.ts']);
  });
});

describe('requiresDistMaterialization', () => {
  it('requires materialization for JSON, CSS and JS-family extensions', () => {
    expect(requiresDistMaterialization('../x.json')).toBe(true);
    expect(requiresDistMaterialization('./x.css')).toBe(true);
    expect(requiresDistMaterialization('./x.js')).toBe(true);
    expect(requiresDistMaterialization('./x.mjs')).toBe(true);
    expect(requiresDistMaterialization('./x.cjs')).toBe(true);
  });

  it('does not require materialization for source-only extensions', () => {
    expect(requiresDistMaterialization('./x.ts')).toBe(false);
    expect(requiresDistMaterialization('./x.tsx')).toBe(false);
    expect(requiresDistMaterialization('./x.svelte')).toBe(false);
  });

  it('does not require materialization for an extensionless specifier', () => {
    expect(requiresDistMaterialization('./x')).toBe(false);
  });
});

describe('findUnresolvedRelativeImports', () => {
  it('flags a JSON specifier the dist tree does not carry', () => {
    const content = "import x from '../components/button/button.constraints.json';";
    const offenders = findUnresolvedRelativeImports(
      'exports/metadata-constraints.d.ts',
      content,
      () => false,
    );
    expect(offenders).toEqual([
      {
        file: 'exports/metadata-constraints.d.ts',
        specifier: '../components/button/button.constraints.json',
        resolvedPath: 'components/button/button.constraints.json',
      },
    ]);
  });

  it('does not flag a JSON specifier the dist tree does carry', () => {
    const content = "import x from '../components/button/button.constraints.json';";
    const offenders = findUnresolvedRelativeImports(
      'exports/metadata-constraints.d.ts',
      content,
      (path) => path === 'components/button/button.constraints.json',
    );
    expect(offenders).toEqual([]);
  });

  it('does not flag a .ts source cross-reference with no dist counterpart', () => {
    const content = "export { default as Button } from './components/button/index.ts';";
    const offenders = findUnresolvedRelativeImports('index.d.ts', content, () => false);
    expect(offenders).toEqual([]);
  });

  it('accepts a sibling .d.ts for a .js specifier read from a .d.ts file', () => {
    const content = "export { Button } from './components/button/index.js';";
    const offenders = findUnresolvedRelativeImports(
      'index.d.ts',
      content,
      (path) => path === 'components/button/index.d.ts',
    );
    expect(offenders).toEqual([]);
  });

  it('does not extend the .d.ts fallback to a .js file scanning itself', () => {
    const content = "export { Button } from './components/button/index.js';";
    const offenders = findUnresolvedRelativeImports(
      'index.js',
      content,
      (path) => path === 'components/button/index.d.ts',
    );
    expect(offenders).toHaveLength(1);
  });
});

describe('isArbitraryExtensionSpecifier', () => {
  it('is true for .svelte and .css', () => {
    expect(isArbitraryExtensionSpecifier('./x.svelte')).toBe(true);
    expect(isArbitraryExtensionSpecifier('./x.css')).toBe(true);
  });

  it('is false for every other extension, and for an extensionless specifier', () => {
    expect(isArbitraryExtensionSpecifier('./x.ts')).toBe(false);
    expect(isArbitraryExtensionSpecifier('./x.js')).toBe(false);
    expect(isArbitraryExtensionSpecifier('./x.json')).toBe(false);
    expect(isArbitraryExtensionSpecifier('./x')).toBe(false);
  });
});

describe('arbitraryExtensionDeclarationPath', () => {
  it('inserts .d. before the final extension segment', () => {
    expect(arbitraryExtensionDeclarationPath('components/access-gate/access-gate.svelte')).toBe(
      'components/access-gate/access-gate.d.svelte.ts',
    );
    expect(arbitraryExtensionDeclarationPath('components/access-gate/access-gate.css')).toBe(
      'components/access-gate/access-gate.d.css.ts',
    );
  });
});

describe('findUnresolvedArbitraryExtensionImports', () => {
  it('flags a .svelte specifier with no Node16-correct declaration companion', () => {
    const content = "import AccessGate from './access-gate.svelte';";
    const offenders = findUnresolvedArbitraryExtensionImports(
      'components/access-gate/index.d.ts',
      content,
      () => false,
    );
    expect(offenders).toEqual([
      {
        file: 'components/access-gate/index.d.ts',
        specifier: './access-gate.svelte',
        requiredDeclarationPath: 'components/access-gate/access-gate.d.svelte.ts',
      },
    ]);
  });

  it('does not flag a .svelte specifier whose declaration companion exists', () => {
    const content = "import AccessGate from './access-gate.svelte';";
    const offenders = findUnresolvedArbitraryExtensionImports(
      'components/access-gate/index.d.ts',
      content,
      (path) => path === 'components/access-gate/access-gate.d.svelte.ts',
    );
    expect(offenders).toEqual([]);
  });

  it('flags a .css specifier the same way', () => {
    const content = "import './access-gate.css';";
    const offenders = findUnresolvedArbitraryExtensionImports(
      'components/access-gate/index.d.ts',
      content,
      () => false,
    );
    expect(offenders).toEqual([
      {
        file: 'components/access-gate/index.d.ts',
        specifier: './access-gate.css',
        requiredDeclarationPath: 'components/access-gate/access-gate.d.css.ts',
      },
    ]);
  });

  it('ignores a non-.d.ts file', () => {
    const content = "import AccessGate from './access-gate.svelte';";
    expect(findUnresolvedArbitraryExtensionImports('components/access-gate/index.js', content, () => false)).toEqual(
      [],
    );
  });

  it('ignores a specifier with an unrelated extension', () => {
    const content = "import x from './access-gate.types.ts';";
    expect(findUnresolvedArbitraryExtensionImports('components/access-gate/index.d.ts', content, () => false)).toEqual(
      [],
    );
  });
});

describe('findExtensionlessDeclarationSpecifiers', () => {
  it('flags a bare relative specifier with no extension', () => {
    const content = "export type { ChoiceGridItemProps } from '../choice-grid-item';";
    expect(findExtensionlessDeclarationSpecifiers('components/choice-grid/index.d.ts', content)).toEqual([
      { file: 'components/choice-grid/index.d.ts', specifier: '../choice-grid-item' },
    ]);
  });

  it('does not flag a specifier that already carries an extension', () => {
    const content = "export { Button } from './components/button/index.js';";
    expect(findExtensionlessDeclarationSpecifiers('index.d.ts', content)).toEqual([]);
  });

  it('ignores a non-.d.ts file', () => {
    const content = "export type { X } from '../choice-grid-item';";
    expect(findExtensionlessDeclarationSpecifiers('components/choice-grid/index.js', content)).toEqual([]);
  });
});

describe('findSelfReferentialTypeImports', () => {
  it('flags a bare "." dynamic type import', () => {
    const content =
      'declare const Grid: X & { Item: import("svelte").Component<import(".").GridItemProps, {}, ""> };';
    expect(findSelfReferentialTypeImports('components/grid/index.d.ts', content)).toEqual([
      { file: 'components/grid/index.d.ts', typeName: 'GridItemProps' },
    ]);
  });

  it('flags every self-reference in a file with more than one', () => {
    const content = 'import(".").TabListProps; import(".").TabProps;';
    expect(findSelfReferentialTypeImports('components/tabs/index.d.ts', content)).toEqual([
      { file: 'components/tabs/index.d.ts', typeName: 'TabListProps' },
      { file: 'components/tabs/index.d.ts', typeName: 'TabProps' },
    ]);
  });

  it('does not flag a real relative dynamic import', () => {
    const content = 'import("./grid.types.ts").GridProps;';
    expect(findSelfReferentialTypeImports('components/grid/index.d.ts', content)).toEqual([]);
  });

  it('ignores a non-.d.ts file', () => {
    expect(findSelfReferentialTypeImports('components/grid/index.js', 'import(".").GridItemProps;')).toEqual([]);
  });
});

describe('findMatchingReexportPath', () => {
  it('finds the path for a name in a single-name export type statement', () => {
    const content = "export type { GridItemProps } from '../grid-item/grid-item.types.ts';";
    expect(findMatchingReexportPath(content, 'GridItemProps')).toBe('../grid-item/grid-item.types.ts');
  });

  it('finds the path for a name among several in the same statement', () => {
    const content =
      "export type { SpeedDialActionLabelPlacement, SpeedDialActionProps, } from '../speed-dial-action/speed-dial-action.types.ts';";
    expect(findMatchingReexportPath(content, 'SpeedDialActionProps')).toBe(
      '../speed-dial-action/speed-dial-action.types.ts',
    );
  });

  it('picks the statement whose name list actually contains the name, not a prefix match', () => {
    const content = [
      "export type { TabProps } from '../tab/tab.types.ts';",
      "export type { TabPanelProps } from '../tab-panel/tab-panel.types.ts';",
    ].join('\n');
    expect(findMatchingReexportPath(content, 'TabPanelProps')).toBe('../tab-panel/tab-panel.types.ts');
    expect(findMatchingReexportPath(content, 'TabProps')).toBe('../tab/tab.types.ts');
  });

  it('returns undefined when no statement re-exports the name', () => {
    const content = "export type { Other } from './other.ts';";
    expect(findMatchingReexportPath(content, 'Missing')).toBeUndefined();
  });
});
