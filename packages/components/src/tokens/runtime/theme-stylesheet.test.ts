import { describe, expect, test } from 'bun:test';

import { CINDER_BASE } from './base-corpus.ts';
import { evaluateThemeProperties } from './evaluate.ts';
import {
  applyCssOnlyOverrides,
  buildThemeSources,
  mergedContextDocument,
} from './theme-sources.ts';
import {
  renderThemeStylesheet,
  StylesheetError,
  type ContextProperties,
  type StylesheetContext,
} from './theme-stylesheet.ts';

const emptyOverrides = { shared: {}, light: {}, dark: {}, reduced: {}, forcedReduced: {} };
const envelope = { base: CINDER_BASE, overrides: emptyOverrides };

function evaluatedMaps(): ContextProperties {
  const result = evaluateThemeProperties(buildThemeSources(envelope, 1));
  if (!result.ok) throw new Error('the shipped base must evaluate');
  return result.properties as ContextProperties;
}

const maps = evaluatedMaps();
const css = renderThemeStylesheet(maps, { identity: 'test theme' });

function withValue(context: StylesheetContext, name: string, value: string): ContextProperties {
  return { ...maps, [context]: { ...maps[context], [name]: value } };
}

describe('buildThemeSources', () => {
  test('appends one override document per scope to the resolver without mutating the base', () => {
    const sources = buildThemeSources(envelope, 3);
    expect(sources.revision).toBe(3);
    expect(Object.keys(sources.documents)).toContain('overrides/forced-reduced-motion.tokens.json');
    expect(JSON.stringify(CINDER_BASE.resolver)).not.toContain('overrides/');
  });
});

describe('mergedContextDocument', () => {
  const radius = (document: unknown) =>
    (document as { radius: { medium: { $value: unknown } } }).radius.medium.$value;

  test('lays a context override over the base without flattening or evaluating it', () => {
    const override = { radius: { medium: { $value: { value: 9, unit: 'px' } } } };
    const sources = buildThemeSources(
      { base: CINDER_BASE, overrides: { ...emptyOverrides, dark: override } },
      1,
    );
    expect(radius(mergedContextDocument(sources, { theme: 'dark', motion: 'default' }))).toEqual({
      value: 9,
      unit: 'px',
    });
    expect(
      radius(mergedContextDocument(sources, { theme: 'light', motion: 'default' })),
    ).not.toEqual({ value: 9, unit: 'px' });
  });
});

describe('renderThemeStylesheet', () => {
  test('puts the whole theme in the named layer, ordered after every Cinder layer', () => {
    expect(css).toContain(
      '@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities, cinder-theme;',
    );
    expect(css).toContain('@layer cinder-theme {');
    expect(css).toContain(' * test theme');
  });

  test('uses the generator skeleton: root and descendant theme scopes, media, forced motion', () => {
    expect(css).toContain(":root[data-theme='dark']");
    expect(css).toContain("[data-theme='light'] {");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(":root[data-reduced-motion='on'] {");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  test('declares only public Cinder properties and no reset or component selector', () => {
    const properties = [...css.matchAll(/^\s+(--[\w-]+):/gm)].map((match) => match[1]);
    expect(properties.length).toBeGreaterThan(300);
    expect(properties.every((name) => name?.startsWith('--cinder-'))).toBe(true);
    const selectors = [...css.matchAll(/^([^\s@/*][^{\n]*)\{/gm)].map((match) => match[1] ?? '');
    expect(selectors.every((selector) => /^(:root|\[data-theme)/.test(selector.trim()))).toBe(true);
  });

  test('restates a motion difference for the theme that changes it, and only there', () => {
    const lightOnly = withValue('light/reduced', '--cinder-radius-md', '9px');
    const output = renderThemeStylesheet(lightOnly);
    expect(output).toContain('--cinder-radius-md: 9px;');
    const darkRestates = renderThemeStylesheet(
      withValue('dark/default', '--cinder-radius-md', '3px'),
    );
    expect(darkRestates).toContain('--cinder-radius-md: 3px;');
  });

  test('restates an alias whose text is unchanged but whose input differs, in every scope', () => {
    // Custom properties substitute var() where they are declared, so a nested scope would
    // inherit the outer scope's substituted value of --cinder-b unless it is declared again.
    const synthetic = (a: string, motionA = a) => ({
      '--cinder-a': a,
      '--cinder-b': 'var(--cinder-a)',
      '--cinder-motion-a': motionA,
      '--cinder-c': 'var(--cinder-motion-a)',
    });
    const contexts: ContextProperties = {
      'light/default': synthetic('1px'),
      'light/reduced': synthetic('1px', '0px'),
      'light/forced-reduced-motion': synthetic('1px', '0px'),
      'dark/default': synthetic('2px'),
      'dark/reduced': synthetic('2px', '0px'),
      'dark/forced-reduced-motion': synthetic('2px', '0px'),
    };
    const output = renderThemeStylesheet(contexts);
    const darkBlock = output.slice(output.indexOf("\n[data-theme='dark'] {"));
    expect(darkBlock.slice(0, darkBlock.indexOf('}'))).toContain('--cinder-b: var(--cinder-a);');
    const reduced = output.slice(output.indexOf('@media (prefers-reduced-motion'));
    expect(reduced.slice(0, reduced.indexOf('}'))).toContain('--cinder-c: var(--cinder-motion-a);');
  });

  test.each([
    ['a declaration terminator', 'red; --x: 1'],
    ['a closing brace', 'red}'],
    ['a comment', 'red /* x */'],
    ['a resource function', 'url(https://example.test/x.png)'],
    ['an escape', 'r\\65 d'],
    ['an important flag', 'red !important'],
    ['an empty value', '  '],
  ])('refuses %s', (_label, value) => {
    expect(() =>
      renderThemeStylesheet(withValue('light/default', '--cinder-radius-md', value)),
    ).toThrow(StylesheetError);
  });

  test('reports a refusal as a StylesheetError that names itself', () => {
    const run = () => renderThemeStylesheet(withValue('light/default', '--cinder-radius-md', ''));
    expect(run).toThrow(StylesheetError);
    expect(run).toThrow('The value of --cinder-radius-md is not a plain CSS value.');
    expect(new StylesheetError('x').name).toBe('StylesheetError');
  });

  test('refuses a property outside the public Cinder surface', () => {
    expect(() => renderThemeStylesheet(withValue('light/default', '--_cinder-x', '1px'))).toThrow(
      StylesheetError,
    );
  });
});

describe('applyCssOnlyOverrides', () => {
  test('lays a context value over its public property and ignores unknown paths', () => {
    const merged = applyCssOnlyOverrides(
      { '--cinder-carousel-slide-size': '100%' },
      {
        'carousel.slide-size': { 'dark/default': '80%' },
        'not.a.token': { 'dark/default': '1px' },
      },
      'dark/default',
    );
    expect(merged).toEqual({ '--cinder-carousel-slide-size': '80%' });
  });

  test('skips a value the caller refuses', () => {
    const merged = applyCssOnlyOverrides(
      { '--cinder-carousel-slide-size': '100%' },
      { 'carousel.slide-size': { 'dark/default': '80%' } },
      'dark/default',
      () => false,
    );
    expect(merged['--cinder-carousel-slide-size']).toBe('100%');
  });
});
