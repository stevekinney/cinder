import { describe, expect, test } from 'bun:test';
import type { ResolverDocument } from './types.ts';
import {
  combinations,
  expandContextSources,
  expandSetSources,
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

  test('applies RFC 6901 decode order: percent-decode the fragment, then split, then tilde-decode', () => {
    const withName = (ref: string): ResolverDocument => ({
      version: '2025.10',
      sets: { 'high contrast': { sources: [{ $ref: 'sets/hc.tokens.json' }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: ref }],
    });

    // %20 decodes to a space inside a single segment, naming a real set.
    expect(parseResolutionOrder(withName('#/sets/high%20contrast'))).toEqual([
      { kind: 'sets', name: 'high contrast' },
    ]);

    // %2F decodes to a literal slash, making this a three-segment pointer
    // rather than a set named `foo/bar` -- which is only addressable as
    // `#/sets/foo~1bar`. Decoding after splitting would wrongly accept it.
    expect(() => parseResolutionOrder(withName('#/sets/foo%2Fbar'))).toThrow();

    // An unescaped slash is a deeper pointer, not a name containing a slash.
    expect(() => parseResolutionOrder(withName('#/sets/foo/bar'))).toThrow();

    // A malformed percent-escape is rejected, not thrown out of decodeURIComponent.
    expect(() => parseResolutionOrder(withName('#/sets/bad%2'))).toThrow(
      /not a well-formed pointer/,
    );
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

describe('CIN-464: resolver-internal set references in source lists', () => {
  test("expands a set source referencing another set to that set's own documents, in order", () => {
    const withInternalRef: ResolverDocument = {
      version: '2025.10',
      sets: {
        base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
        extended: {
          sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/extra.tokens.json' }],
        },
      },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/extended' }],
    };

    expect(expandSetSources(withInternalRef, 'extended')).toEqual([
      { $ref: 'sets/base.tokens.json' },
      { $ref: 'sets/extra.tokens.json' },
    ]);
    expect(sourcesForEntry(withInternalRef, { kind: 'sets', name: 'extended' }, {})).toEqual([
      { $ref: 'sets/base.tokens.json' },
      { $ref: 'sets/extra.tokens.json' },
    ]);
  });

  test("a referenced set's own sources may contain further internal references", () => {
    const chained: ResolverDocument = {
      version: '2025.10',
      sets: {
        base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
        middle: { sources: [{ $ref: '#/sets/base' }] },
        top: { sources: [{ $ref: '#/sets/middle' }] },
      },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/top' }],
    };

    expect(expandSetSources(chained, 'top')).toEqual([{ $ref: 'sets/base.tokens.json' }]);
  });

  test("a modifier context referencing a set expands to that set's documents", () => {
    const withInternalRef: ResolverDocument = {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: '#/sets/base' }, { $ref: 'themes/light.tokens.json' }],
            dark: [{ $ref: 'themes/dark.tokens.json' }],
          },
        },
      },
      resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
    };

    expect(expandContextSources(withInternalRef, 'theme', 'light')).toEqual([
      { $ref: 'sets/base.tokens.json' },
      { $ref: 'themes/light.tokens.json' },
    ]);
    expect(
      sourcesForEntry(withInternalRef, { kind: 'modifiers', name: 'theme' }, { theme: 'light' }),
    ).toEqual([{ $ref: 'sets/base.tokens.json' }, { $ref: 'themes/light.tokens.json' }]);
  });

  test('rejects a cycle between two sets with a named path and reason', () => {
    const cyclic: ResolverDocument = {
      version: '2025.10',
      sets: {
        a: { sources: [{ $ref: '#/sets/b' }] },
        b: { sources: [{ $ref: '#/sets/a' }] },
      },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/a' }],
    };

    expect(() => expandSetSources(cyclic, 'a')).toThrow(/cyclic set reference/);
    try {
      expandSetSources(cyclic, 'a');
      throw new Error('expected expandSetSources to throw');
    } catch (error) {
      expect(String(error)).toContain('$.sets.a.sources');
    }
  });

  test('rejects a set referencing a modifier with a named path and reason', () => {
    const setReferencingModifier: ResolverDocument = {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: '#/modifiers/theme' }] } },
      modifiers: {
        theme: { contexts: { light: [{ $ref: 'themes/light.tokens.json' }] } },
      },
      resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
    };

    expect(() => expandSetSources(setReferencingModifier, 'base')).toThrow(
      'a set may not reference a modifier',
    );
  });

  test('rejects a modifier context referencing another modifier with a named path and reason', () => {
    const contextReferencingModifier: ResolverDocument = {
      version: '2025.10',
      sets: {},
      modifiers: {
        theme: { contexts: { light: [{ $ref: '#/modifiers/motion' }] } },
        motion: { contexts: { default: [{ $ref: 'modes/motion-default.tokens.json' }] } },
      },
      resolutionOrder: [{ $ref: '#/modifiers/theme' }, { $ref: '#/modifiers/motion' }],
    };

    expect(() => expandContextSources(contextReferencingModifier, 'theme', 'light')).toThrow(
      'a modifier context may not reference another modifier',
    );
  });

  test('still reports a genuinely missing on-disk file clearly, not as a malformed reference', () => {
    const missingFile: ResolverDocument = {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'sets/does-not-exist.tokens.json' }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/base' }],
    };

    // expandSetSources itself only expands internal refs -- it does not check
    // on-disk existence, so a plain file $ref simply passes through.
    expect(expandSetSources(missingFile, 'base')).toEqual([
      { $ref: 'sets/does-not-exist.tokens.json' },
    ]);
  });
});
