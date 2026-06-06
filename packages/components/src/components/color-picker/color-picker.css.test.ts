import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parse, type Declaration } from 'postcss';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

function declarationValue(source: string, property: string): string {
  const root = parse(source);
  let value: string | undefined;
  root.walkDecls(property, (declaration: Declaration) => {
    value = declaration.value;
    return false;
  });
  if (!value) throw new Error(`declaration not found: ${property}`);
  return value;
}

function compactCssValue(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

function lightDarkArms(value: string): [string, string] {
  const match = /^light-dark\(([\s\S]+)\)$/.exec(value.trim());
  if (!match?.[1]) throw new Error(`expected light-dark(), got: ${value}`);
  const inner = match[1];
  let depth = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      return [inner.slice(0, index).trim(), inner.slice(index + 1).trim()];
    }
  }
  throw new Error(`light-dark() missing comma separator: ${value}`);
}

const tokensCss = loadCss('../../styles/tokens-base.css');
const colorPickerCss = loadCss('./color-picker.css');
const colorFieldCss = loadCss('../color-field/color-field.css');
const colorSwatchPickerCss = loadCss('../color-swatch-picker/color-swatch-picker.css');

describe('color checker tokens', () => {
  test('checkerboard tokens keep the light arm and define a distinct dark arm', () => {
    const base = lightDarkArms(declarationValue(tokensCss, '--cinder-color-checker-base'));
    const tile = lightDarkArms(declarationValue(tokensCss, '--cinder-color-checker-tile'));

    expect(base).toEqual(['#fff', 'oklch(28% 0.02 245)']);
    expect(tile).toEqual(['#ccc', 'oklch(38% 0.02 245)']);
    expect(base[0]).not.toBe(base[1]);
    expect(tile[0]).not.toBe(tile[1]);
  });

  test('color components consume the public checker tokens without private checker aliases', () => {
    const componentSources = [colorPickerCss, colorFieldCss, colorSwatchPickerCss];

    for (const source of componentSources) {
      expect(source).toContain('var(--cinder-color-checker-base)');
      expect(source).toContain('var(--cinder-color-checker-tile)');
      expect(source).not.toContain('--_cinder-color-picker-checker-');
      expect(source).not.toContain('--_cinder-color-field-checker-');
      expect(source).not.toContain('--_cinder-color-swatch-picker-checker-');
    }
  });
});

describe('color picker thumb contrast outline', () => {
  test('thumb shadow keeps a dark edge and adds a dark-mode support ring', () => {
    const support = lightDarkArms(
      declarationValue(colorPickerCss, '--_cinder-color-picker-thumb-shadow-support'),
    ).map(compactCssValue);
    const shadow = compactCssValue(
      declarationValue(colorPickerCss, '--_cinder-color-picker-thumb-shadow'),
    );

    expect(declarationValue(colorPickerCss, '--_cinder-color-picker-thumb-border')).toBe('#fff');
    expect(
      compactCssValue(declarationValue(colorPickerCss, '--_cinder-color-picker-thumb-shadow-edge')),
    ).toBe('rgba(0, 0, 0, 0.5)');
    expect(
      declarationValue(colorPickerCss, '--_cinder-color-picker-thumb-shadow-support-light'),
    ).toBe('transparent');
    expect(
      compactCssValue(
        declarationValue(colorPickerCss, '--_cinder-color-picker-thumb-shadow-support-dark'),
      ),
    ).toBe('rgba(255, 255, 255, 0.65)');
    expect(support).toEqual([
      'var(--_cinder-color-picker-thumb-shadow-support-light)',
      'var(--_cinder-color-picker-thumb-shadow-support-dark)',
    ]);
    expect(shadow).toBe(
      '0 0 0 1px var(--_cinder-color-picker-thumb-shadow-edge), 0 0 0 2px var(--_cinder-color-picker-thumb-shadow-support)',
    );
  });
});
