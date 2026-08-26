import { describe, expect, test } from 'bun:test';
import type { ResolverDocument } from './types.ts';
import {
  combinations,
  normalizeSourcePath,
  parseResolutionOrder,
  sourcesForEntry,
} from './validate-corpus.ts';

const resolver: ResolverDocument = {
  version: '2025.10',
  sets: {
    foundation: {
      sources: [{ $ref: 'sets/foundation.tokens.json' }, { $ref: 'sets/semantic.tokens.json' }],
    },
  },
  modifiers: {
    theme: {
      contexts: {
        light: [{ $ref: 'themes/light.tokens.json' }],
        dark: [{ $ref: 'themes/dark.tokens.json' }],
      },
      default: 'light',
    },
    motion: {
      contexts: {
        default: [{ $ref: 'modes/motion-default.tokens.json' }],
        reduced: [{ $ref: 'modes/motion-reduced.tokens.json' }],
      },
      default: 'default',
    },
  },
  resolutionOrder: [
    { $ref: '#/sets/foundation' },
    { $ref: '#/modifiers/theme' },
    { $ref: '#/modifiers/motion' },
  ],
};

describe('token corpus validation', () => {
  test('decodes RFC 6901 tilde escapes so the decoded name still finds its set', () => {
    const escaped: ResolverDocument = {
      version: '2025.10',
      sets: { 'foo/bar': { sources: [{ $ref: 'sets/foo-bar.tokens.json' }] } },
      modifiers: {
        'a~b': {
          contexts: {
            one: [{ $ref: 'modes/one.tokens.json' }],
            two: [{ $ref: 'modes/two.tokens.json' }],
          },
        },
      },
      resolutionOrder: [{ $ref: '#/sets/foo~1bar' }, { $ref: '#/modifiers/a~0b' }],
    };

    const parsed = parseResolutionOrder(escaped);
    expect(parsed).toEqual([
      { kind: 'sets', name: 'foo/bar' },
      { kind: 'modifiers', name: 'a~b' },
    ]);

    // Validation accepts these references, so the lookup they feed must find
    // the entry rather than reading `.sources` off undefined.
    expect(sourcesForEntry(escaped, parsed[0]!, {})).toEqual([
      { $ref: 'sets/foo-bar.tokens.json' },
    ]);
    expect(sourcesForEntry(escaped, parsed[1]!, { 'a~b': 'two' })).toEqual([
      { $ref: 'modes/two.tokens.json' },
    ]);
  });

  test('normalizes source URI references to the globbed repository-relative form', () => {
    expect(normalizeSourcePath('sets/foundation.tokens.json')).toBe('sets/foundation.tokens.json');
    expect(normalizeSourcePath('./sets/foundation.tokens.json')).toBe(
      'sets/foundation.tokens.json',
    );
    expect(normalizeSourcePath('themes/../sets/foundation.tokens.json')).toBe(
      'sets/foundation.tokens.json',
    );
    expect(normalizeSourcePath('sets/with%20space.tokens.json')).toBe(
      'sets/with space.tokens.json',
    );
  });

  test('leaves a malformed percent-escape undecoded rather than throwing', () => {
    expect(normalizeSourcePath('sets/bad%2.tokens.json')).toBe('sets/bad%2.tokens.json');
  });

  test('parses resolutionOrder references into their target kind and name', () => {
    expect(parseResolutionOrder(resolver)).toEqual([
      { kind: 'sets', name: 'foundation' },
      { kind: 'modifiers', name: 'theme' },
      { kind: 'modifiers', name: 'motion' },
    ]);
  });

  test('resolves the sources for a set entry regardless of modifier selection', () => {
    expect(sourcesForEntry(resolver, { kind: 'sets', name: 'foundation' }, {})).toEqual([
      { $ref: 'sets/foundation.tokens.json' },
      { $ref: 'sets/semantic.tokens.json' },
    ]);
  });

  test('resolves the sources for a modifier entry using the selected context', () => {
    expect(
      sourcesForEntry(
        resolver,
        { kind: 'modifiers', name: 'theme' },
        { theme: 'dark', motion: 'default' },
      ),
    ).toEqual([{ $ref: 'themes/dark.tokens.json' }]);
    expect(
      sourcesForEntry(
        resolver,
        { kind: 'modifiers', name: 'motion' },
        { theme: 'dark', motion: 'reduced' },
      ),
    ).toEqual([{ $ref: 'modes/motion-reduced.tokens.json' }]);
  });

  test('computes the cartesian product of every modifier context combination', () => {
    const combos = combinations(resolver);
    expect(combos).toHaveLength(4);
    expect(combos).toEqual(
      expect.arrayContaining([
        { theme: 'light', motion: 'default' },
        { theme: 'light', motion: 'reduced' },
        { theme: 'dark', motion: 'default' },
        { theme: 'dark', motion: 'reduced' },
      ]),
    );
  });

  test('computes a single combination for a resolver with no modifiers', () => {
    const noModifiers: ResolverDocument = { ...resolver, modifiers: {} };
    expect(combinations(noModifiers)).toEqual([{}]);
  });

  test('computes one combination per context for a single-modifier resolver', () => {
    const singleModifier: ResolverDocument = {
      ...resolver,
      modifiers: { theme: resolver.modifiers['theme']! },
    };
    expect(combinations(singleModifier)).toEqual([{ theme: 'light' }, { theme: 'dark' }]);
  });
});
