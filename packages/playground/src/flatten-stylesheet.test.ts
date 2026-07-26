import { describe, expect, test } from 'bun:test';

import { flattenStylesheet, resolveStylesheetImport } from './flatten-stylesheet.ts';

/** Build a reader over an in-memory URL → CSS map. */
function readerFor(files: Record<string, string>) {
  return async (url: string): Promise<string | null> => files[url] ?? null;
}

describe('resolveStylesheetImport', () => {
  test('resolves a sibling specifier', () => {
    expect(resolveStylesheetImport('/styles/index.css', './tokens.css')).toBe('/styles/tokens.css');
  });

  test('resolves a parent-relative specifier', () => {
    expect(resolveStylesheetImport('/styles/shell.css', '../components/button/button.css')).toBe(
      '/components/button/button.css',
    );
  });

  test('resolves nested parent traversal', () => {
    expect(resolveStylesheetImport('/a/b/c/d.css', '../../x.css')).toBe('/a/x.css');
  });

  test('passes through a root-relative specifier', () => {
    expect(resolveStylesheetImport('/styles/index.css', '/components/x.css')).toBe(
      '/components/x.css',
    );
  });

  test('returns null for a bare specifier it cannot resolve', () => {
    expect(resolveStylesheetImport('/styles/index.css', 'some-package/x.css')).toBeNull();
  });
});

describe('flattenStylesheet', () => {
  test('inlines a plain import and leaves no @import behind', async () => {
    const css = await flattenStylesheet(
      '/styles/shell.css',
      readerFor({
        '/styles/shell.css': "@import './index.css';\n.shell { color: red; }",
        '/styles/index.css': '.base { color: blue; }',
      }),
    );

    expect(css).not.toContain('@import');
    expect(css).toContain('.base { color: blue; }');
    expect(css).toContain('.shell { color: red; }');
  });

  test('wraps a layered import in an equivalent @layer block', async () => {
    const css = await flattenStylesheet(
      '/styles/index.css',
      readerFor({
        '/styles/index.css': "@import './utilities.css' layer(cinder.utilities);",
        '/styles/utilities.css': '.cinder-sr-only { position: absolute; }',
      }),
    );

    expect(css).toContain('@layer cinder.utilities {');
    expect(css).toContain('.cinder-sr-only { position: absolute; }');
    expect(css).not.toContain('@import');
  });

  test('keeps unlayered imports unlayered so they still outrank layered rules', async () => {
    const css = await flattenStylesheet(
      '/styles/shell.css',
      readerFor({
        '/styles/shell.css': "@import './a.css' layer(cinder.tokens);\n@import './b.css';",
        '/styles/a.css': '.a { color: red; }',
        '/styles/b.css': '.b { color: blue; }',
      }),
    );

    expect(css).toContain('@layer cinder.tokens {');
    // `.b` must NOT be wrapped — an unlayered sheet beats every layer.
    const bIndex = css.indexOf('.b { color: blue; }');
    const layerClose = css.lastIndexOf('}', bIndex);
    expect(css.slice(layerClose, bIndex)).not.toContain('@layer');
  });

  test('preserves import order', async () => {
    const css = await flattenStylesheet(
      '/s/entry.css',
      readerFor({
        '/s/entry.css': "@import './one.css';\n@import './two.css';\n.last { color: green; }",
        '/s/one.css': '.one {}',
        '/s/two.css': '.two {}',
      }),
    );

    expect(css.indexOf('.one {}')).toBeLessThan(css.indexOf('.two {}'));
    expect(css.indexOf('.two {}')).toBeLessThan(css.indexOf('.last { color: green; }'));
  });

  test('recurses through a multi-level graph', async () => {
    const css = await flattenStylesheet(
      '/styles/shell.css',
      readerFor({
        '/styles/shell.css': "@import './index.css';",
        '/styles/index.css': "@import './utilities.css' layer(cinder.utilities);",
        '/styles/utilities.css': '.cinder-sr-only { position: absolute; }',
      }),
    );

    expect(css).toContain('.cinder-sr-only { position: absolute; }');
    expect(css).not.toContain('@import');
  });

  test('handles url() and double-quoted import syntax', async () => {
    const css = await flattenStylesheet(
      '/s/entry.css',
      readerFor({
        '/s/entry.css': '@import url(./a.css);\n@import "./b.css" layer(l);',
        '/s/a.css': '.a {}',
        '/s/b.css': '.b {}',
      }),
    );

    expect(css).toContain('.a {}');
    expect(css).toContain('@layer l {');
    expect(css).not.toContain('@import');
  });

  test('breaks import cycles instead of hanging', async () => {
    const css = await flattenStylesheet(
      '/s/a.css',
      readerFor({
        '/s/a.css': "@import './b.css';\n.a {}",
        '/s/b.css': "@import './a.css';\n.b {}",
      }),
    );

    expect(css).toContain('.a {}');
    expect(css).toContain('.b {}');
    expect(css).toContain('already inlined');
  });

  test('does not import the same sheet twice', async () => {
    const css = await flattenStylesheet(
      '/s/entry.css',
      readerFor({
        '/s/entry.css': "@import './shared.css';\n@import './shared.css';",
        '/s/shared.css': '.shared { color: red; }',
      }),
    );

    expect(css.split('.shared { color: red; }').length - 1).toBe(1);
  });

  test('degrades to a comment for a missing import rather than throwing', async () => {
    const css = await flattenStylesheet(
      '/s/entry.css',
      readerFor({ '/s/entry.css': "@import './gone.css';\n.kept {}" }),
    );

    expect(css).toContain('not found');
    expect(css).toContain('.kept {}');
  });

  test('returns a sheet with no imports unchanged', async () => {
    const source = '.a { color: red; }';

    expect(await flattenStylesheet('/s/a.css', readerFor({ '/s/a.css': source }))).toBe(source);
  });
});
