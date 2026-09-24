import { describe, expect, it } from 'bun:test';

import {
  findRelativeSpecifiers,
  findUnresolvedRelativeImports,
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
