import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isToken, isTokenGroup } from './resolve-merge.ts';
import { resolveDocuments } from './resolve.ts';
import { TokenValidationError, type ResolverDocument, type TokenDocument } from './types.ts';
import {
  combinations,
  parseResolutionOrder,
  sourcesForEntry,
  validateLoadedTokenDocuments,
} from './validate-corpus.ts';
import { validateResolverDocumentSchema, validateTokenDocumentSchema } from './validate-schema.ts';
import { assertValidResolverDocument, assertValidTokenDocument } from './validate.ts';

const directory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(directory, 'fixtures');
const themeBuilderDirectory = join(fixtureDirectory, 'theme-builder');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function readTokenFixture(directoryName: 'valid' | 'invalid', name: string): unknown {
  return readJson(join(fixtureDirectory, directoryName, name));
}

function collectTypes(value: unknown, result = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return result;
  if (Array.isArray(value)) {
    for (const entry of value) collectTypes(entry, result);
    return result;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$type' && typeof entry === 'string') result.add(entry);
    else collectTypes(entry, result);
  }
  return result;
}

const types = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
] as const;

const invalidFirstIssues: Record<string, { path: string; reason: string }> = {
  'border.tokens.json': {
    path: 'border.tokens.json.sample.$value',
    reason: "must have required property 'style'",
  },
  'color-hex-eight-digit.tokens.json': {
    path: 'color-hex-eight-digit.tokens.json.sample.$value.hex',
    reason: 'must match pattern "^#[0-9a-fA-F]{6}$"',
  },
  'color.tokens.json': {
    path: 'color.tokens.json.sample.$value.colorSpace',
    reason:
      'must be one of ["srgb","srgb-linear","hsl","hwb","lab","lch","oklab","oklch","display-p3","a98-rgb","prophoto-rgb","rec2020","xyz-d65","xyz-d50"]',
  },
  'cubicBezier.tokens.json': {
    path: 'cubicBezier.tokens.json.sample.$value.0',
    reason: 'must be <= 1',
  },
  'dimension.tokens.json': {
    path: 'dimension.tokens.json.sample.$value',
    reason: "must have required property 'unit'",
  },
  'duration.tokens.json': {
    path: 'duration.tokens.json.sample',
    reason: 'duration must have a non-negative numeric value and ms or s unit',
  },
  'fontFamily.tokens.json': {
    path: 'fontFamily.tokens.json.sample.$value',
    reason: 'must be string',
  },
  'fontWeight.tokens.json': {
    path: 'fontWeight.tokens.json.sample.$value',
    reason: 'must be >= 1',
  },
  'gradient.tokens.json': {
    path: 'gradient.tokens.json.sample',
    reason: 'gradient must contain at least two color-position stops',
  },
  'number.tokens.json': {
    path: 'number.tokens.json.sample.$value',
    reason: 'must be number',
  },
  'shadow.tokens.json': {
    path: 'shadow.tokens.json.sample.$value',
    reason: "must have required property 'spread'",
  },
  'strokeStyle.tokens.json': {
    path: 'strokeStyle.tokens.json.sample.$value',
    reason: 'must be one of ["solid","dashed","dotted","double","groove","ridge","outset","inset"]',
  },
  'transition.tokens.json': {
    path: 'transition.tokens.json.sample.$value',
    reason: "must NOT have additional property 'timingFuction'",
  },
  'typography.tokens.json': {
    path: 'typography.tokens.json.sample.$value',
    reason: "must have required property 'fontWeight'",
  },
};

describe('theme-builder capability fixtures', () => {
  test('all thirteen positive type fixtures pass schema and semantic gates', () => {
    const validFixtureNames = readdirSync(join(fixtureDirectory, 'valid'))
      .filter((name) => name.endsWith('.tokens.json'))
      .toSorted();
    const validDocuments = validFixtureNames.map((name) =>
      readJson(join(fixtureDirectory, 'valid', name)),
    );
    const fixtureTypes = new Set(validDocuments.flatMap((document) => [...collectTypes(document)]));
    expect(fixtureTypes).toEqual(new Set(types));
    const allTypes = readJson(join(themeBuilderDirectory, 'all-types.tokens.json'));
    expect(collectTypes(allTypes)).toEqual(fixtureTypes);
    for (const type of fixtureTypes) {
      const document = readTokenFixture('valid', `${type}.tokens.json`);
      expect(() => validateTokenDocumentSchema(document)).not.toThrow();
      expect(() => assertValidTokenDocument(document, `${type}.tokens.json`)).not.toThrow();
    }
    expect(() => validateTokenDocumentSchema(allTypes)).not.toThrow();
    expect(() => assertValidTokenDocument(allTypes, 'all-types.tokens.json')).not.toThrow();
  });

  test('all invalid type fixtures retain exact first diagnostics', () => {
    for (const [name, expected] of Object.entries(invalidFirstIssues)) {
      let caught: unknown;
      try {
        assertValidTokenDocument(readTokenFixture('invalid', name), name);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(TokenValidationError);
      const firstIssue = (caught as TokenValidationError).issues[0];
      expect(firstIssue).toEqual(expected);
    }
  });

  test('color fixture covers authored color space, component none, and fractional alpha', () => {
    const document = readJson(
      join(themeBuilderDirectory, 'all-types.tokens.json'),
    ) as TokenDocument;
    document['color'] = {
      $type: 'color',
      $value: { colorSpace: 'oklch', components: [0.5, 'none', 40], alpha: 0.5 },
    };
    expect(() => assertValidTokenDocument(document, 'color-none.tokens.json')).not.toThrow();
  });

  test('resolver fixture is valid and supplies every theme and motion context', () => {
    const profile = readJson(
      join(themeBuilderDirectory, 'profile.resolver.json'),
    ) as ResolverDocument;
    expect(() => validateResolverDocumentSchema(profile)).not.toThrow();
    expect(() => assertValidResolverDocument(profile)).not.toThrow();
    const loaded = [
      'base.tokens.json',
      'light.tokens.json',
      'dark.tokens.json',
      'motion-default.tokens.json',
      'motion-reduced.tokens.json',
      'motion-forced-reduced-motion.tokens.json',
    ].map((name) => ({ path: name, document: readJson(join(themeBuilderDirectory, name)) }));
    const validated = validateLoadedTokenDocuments(profile, loaded);
    const documentsByPath = new Map(validated.map(({ path, document }) => [path, document]));
    const order = parseResolutionOrder(profile);
    const before = JSON.stringify(loaded);
    const expectedThemes = { light: 2, dark: 3 } as const;
    const expectedMotions = { default: 4, reduced: 5, 'forced-reduced-motion': 6 } as const;
    for (const selection of combinations(profile)) {
      const orderedDocuments = order.flatMap((entry) =>
        sourcesForEntry(profile, entry, selection).map(
          (source) => documentsByPath.get(source.$ref)!,
        ),
      );
      const resolved = resolveDocuments(orderedDocuments);
      expect(resolved['theme']!.$value).toBe(
        expectedThemes[selection['theme'] as keyof typeof expectedThemes],
      );
      expect(resolved['motion']!.$value).toBe(
        expectedMotions[selection['motion'] as keyof typeof expectedMotions],
      );
      expect(resolved['fixture']!.$value).toBe(100);
    }
    expect(JSON.stringify(loaded)).toBe(before);
  });

  test('CSS-only fixture preserves authored values and real CSS recipes', () => {
    const document = readJson(join(themeBuilderDirectory, 'css-only.tokens.json')) as TokenDocument;
    expect(() => assertValidTokenDocument(document, 'css-only.tokens.json')).not.toThrow();
    const carousel = document['carousel'];
    const codeBlock = document['code-block'];
    const spinner = document['spinner'];
    if (!isTokenGroup(carousel) || !isTokenGroup(codeBlock) || !isTokenGroup(spinner))
      throw new Error('CSS-only fixture groups are malformed');
    const slideSize = carousel['slide-size'];
    const aspectRatio = carousel['aspect-ratio'];
    const height = codeBlock['height'];
    const indicator = spinner['indicator'];
    if (!isToken(slideSize) || !isToken(aspectRatio) || !isToken(height) || !isToken(indicator))
      throw new Error('CSS-only fixture tokens are malformed');
    expect(slideSize.$value).toBe(100);
    expect(slideSize.$extensions).toEqual({
      'com.lostgradient.cinder': { cssRecipe: '100%' },
    });
    expect(aspectRatio.$value).toBe(1.7778);
    expect(height.$value).toEqual({ value: 0, unit: 'rem' });
    expect(indicator.$value).toBe('{text.default}');
    expect(indicator.$extensions).toEqual({
      'com.lostgradient.cinder': { cssRecipe: 'currentColor' },
    });
  });

  test('resolver preserves inherited metadata, root, references, and extensions', () => {
    const source = {
      $type: 'number',
      $deprecated: 'use replacement',
      $extensions: { 'com.example.editor': { keep: true } },
      base: { $root: { $value: 2 }, value: { $value: 3 } },
      alias: { $value: '{base.value}' },
    } as TokenDocument;
    const before = JSON.stringify(source);
    const resolved = resolveDocuments([source]);
    expect(resolved['base']!.$value).toBe(2);
    expect(resolved['alias']!.$value).toBe(3);
    expect(JSON.stringify(source)).toBe(before);
  });
});
