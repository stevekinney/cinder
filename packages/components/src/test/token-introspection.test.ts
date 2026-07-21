import { describe, expect, test } from 'bun:test';

import { extractRootBlock, readRootTokenNames } from './token-introspection.ts';

describe('extractRootBlock', () => {
  test('returns the body of the top-level :root block', () => {
    const css = `:root {\n  --cinder-accent: red;\n}\n`;
    expect(extractRootBlock(css)).toContain('--cinder-accent: red;');
  });

  test('is tolerant of reindentation', () => {
    const css = ['  :root   {', '      --cinder-accent: red;', '  }'].join('\n');
    expect(extractRootBlock(css)).toContain('--cinder-accent: red;');
  });

  test('skips a preceding scoped :root[data-theme] block', () => {
    const css = [
      ":root[data-theme='dark'] {",
      '  color-scheme: dark;',
      '}',
      '',
      ':root {',
      '  --cinder-accent: red;',
      '}',
    ].join('\n');

    const body = extractRootBlock(css);
    expect(body).toContain('--cinder-accent: red;');
    expect(body).not.toContain('color-scheme');
  });

  test('skips a :root block nested inside @media', () => {
    const css = [
      ':root {',
      '  --cinder-accent: red;',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  :root {',
      '    --cinder-duration-spin: 0ms;',
      '  }',
      '}',
    ].join('\n');

    const body = extractRootBlock(css);
    expect(body).toContain('--cinder-accent: red;');
    expect(body).not.toContain('--cinder-duration-spin');
  });

  test('throws when no bare :root block exists', () => {
    const css = ":root[data-theme='dark'] { color-scheme: dark; }";
    expect(() => extractRootBlock(css)).toThrow('Could not find :root { ... } block');
  });
});

describe('readRootTokenNames', () => {
  test('collects --cinder-* declaration names from the :root block', () => {
    const css = `:root {\n  --cinder-accent: red;\n  --cinder-space-4: 1rem;\n}\n`;
    expect(readRootTokenNames(css)).toEqual(new Set(['--cinder-accent', '--cinder-space-4']));
  });

  test('ignores tokens inside comments', () => {
    const css = [
      ':root {',
      '  /* --cinder-future: reserved */',
      '  --cinder-accent: red;',
      '}',
    ].join('\n');

    expect(readRootTokenNames(css)).toEqual(new Set(['--cinder-accent']));
  });

  test('ignores non-cinder custom properties', () => {
    const css = `:root {\n  --some-other-token: 1;\n  --cinder-accent: red;\n}\n`;
    expect(readRootTokenNames(css)).toEqual(new Set(['--cinder-accent']));
  });

  test('is tolerant of reindentation', () => {
    const css = ['  :root   {', '      --cinder-accent: red;', '  }'].join('\n');
    expect(readRootTokenNames(css)).toEqual(new Set(['--cinder-accent']));
  });

  test('excludes tokens from a preceding scoped :root[data-theme] block', () => {
    const css = [
      ":root[data-theme='dark'] {",
      '  --cinder-shadow-sm: 0 0 0 black;',
      '}',
      '',
      ':root {',
      '  --cinder-accent: red;',
      '}',
    ].join('\n');

    expect(readRootTokenNames(css)).toEqual(new Set(['--cinder-accent']));
  });

  test('excludes tokens from a :root block nested inside @media', () => {
    const css = [
      ':root {',
      '  --cinder-accent: red;',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  :root {',
      '    --cinder-duration-spin: 0ms;',
      '  }',
      '}',
    ].join('\n');

    expect(readRootTokenNames(css)).toEqual(new Set(['--cinder-accent']));
  });

  test('throws when no bare :root block exists', () => {
    const css = ":root[data-theme='dark'] { color-scheme: dark; }";
    expect(() => readRootTokenNames(css)).toThrow('Could not find :root { ... } block');
  });
});
