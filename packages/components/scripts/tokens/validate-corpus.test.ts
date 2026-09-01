import { describe, expect, test } from 'bun:test';
import type { ResolverDocument } from './types.ts';
import {
  buildContextSourcesIndex,
  combinations,
  expandContextSources,
  expandSetSources,
  normalizeSourcePath,
  parseResolutionOrder,
  sourcesForEntry,
  validateModifierSetExpansionOrder,
  validateModifierTokenPaths,
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
      // The reference SITE, not the set being re-visited: `a`'s sources name
      // `b`, and `b`'s sources are what names `a` again and closes the loop
      // -- `b.sources` is the array actually containing the offending
      // back-reference, so that is what the error should point a reader at,
      // rather than `a.sources` (the earlier, non-cyclic hop).
      expect(String(error)).toContain('$.sets.b.sources');
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

  test('an unknown set referenced from another set is reported at the referencing sources array', () => {
    // Regression: the thrown path used to be `$.sets.<missing>`, which does
    // not exist in the document and does not point a reader at the actual
    // reference site.
    const missingSet: ResolverDocument = {
      version: '2025.10',
      sets: { extended: { sources: [{ $ref: '#/sets/does-not-exist' }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/extended' }],
    };

    expect(() => expandSetSources(missingSet, 'extended')).toThrow(
      /resolver-internal reference names an unknown set/,
    );
    try {
      expandSetSources(missingSet, 'extended');
      throw new Error('expected expandSetSources to throw');
    } catch (error) {
      expect(String(error)).toContain('$.sets.extended.sources');
      expect(String(error)).not.toContain('$.sets.does-not-exist');
    }
  });

  test('an unknown set referenced from a modifier context is reported at the referencing context', () => {
    const missingSet: ResolverDocument = {
      version: '2025.10',
      sets: {},
      modifiers: { theme: { contexts: { light: [{ $ref: '#/sets/does-not-exist' }] } } },
      resolutionOrder: [{ $ref: '#/modifiers/theme' }],
    };

    try {
      expandContextSources(missingSet, 'theme', 'light');
      throw new Error('expected expandContextSources to throw');
    } catch (error) {
      expect(String(error)).toContain('$.modifiers.theme.contexts.light');
      expect(String(error)).not.toContain('$.sets.does-not-exist');
    }
  });

  test('a percent-encoded internal set reference is classified as internal, not a file path', () => {
    // `#%2Fsets%2Fbase` percent-decodes to `#/sets/base`. `resolutionOrderTarget`
    // (validate.ts) decodes before parsing and correctly recognizes it as
    // internal; a raw, undecoded `startsWith('#/')` classification check here
    // disagreed, treating the identical reference as an on-disk file and
    // reporting it as a nonexistent document named `#%2Fsets%2Fbase` instead
    // of expanding the set.
    const encoded: ResolverDocument = {
      version: '2025.10',
      sets: {
        base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
        extended: { sources: [{ $ref: '#%2Fsets%2Fbase' }] },
      },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/extended' }],
    };

    expect(expandSetSources(encoded, 'extended')).toEqual([{ $ref: 'sets/base.tokens.json' }]);
  });

  test('a percent-encoded leading hash remains an on-disk path', () => {
    const encodedPath: ResolverDocument = {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: '%23%2Fsets%2Fbase.tokens.json' }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/base' }],
    };

    expect(expandSetSources(encodedPath, 'base')).toEqual([
      { $ref: '%23%2Fsets%2Fbase.tokens.json' },
    ]);
  });

  test('rejects a later modifier re-expanding a set after an intervening modifier', () => {
    const resetting: ResolverDocument = {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        motion: { contexts: { reduced: [{ $ref: 'motion.json' }] } },
        theme: { contexts: { dark: [{ $ref: '#/sets/base' }, { $ref: 'dark.json' }] } },
      },
      resolutionOrder: [
        { $ref: '#/sets/base' },
        { $ref: '#/modifiers/motion' },
        { $ref: '#/modifiers/theme' },
      ],
    };

    expect(() => validateModifierSetExpansionOrder(resetting)).toThrow(
      /set "base" is re-expanded after modifier "motion"/,
    );
  });

  test('rejects a later modifier transitively re-expanding a base set', () => {
    const resetting: ResolverDocument = {
      version: '2025.10',
      sets: {
        base: { sources: [{ $ref: 'base.json' }] },
        themeOverrides: {
          sources: [{ $ref: '#/sets/base' }, { $ref: 'dark.json' }],
        },
      },
      modifiers: {
        motion: { contexts: { reduced: [{ $ref: 'motion.json' }] } },
        theme: { contexts: { dark: [{ $ref: '#/sets/themeOverrides' }] } },
      },
      resolutionOrder: [
        { $ref: '#/sets/base' },
        { $ref: '#/modifiers/motion' },
        { $ref: '#/modifiers/theme' },
      ],
    };

    expect(() => validateModifierSetExpansionOrder(resetting)).toThrow(
      /set "base" is re-expanded after modifier "motion"/,
    );
  });

  test('rejects a later modifier directly re-expanding an ordered base document', () => {
    const resetting: ResolverDocument = {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        motion: { contexts: { reduced: [{ $ref: 'motion.json' }] } },
        theme: { contexts: { light: [{ $ref: './base.json' }] } },
      },
      resolutionOrder: [
        { $ref: '#/sets/base' },
        { $ref: '#/modifiers/motion' },
        { $ref: '#/modifiers/theme' },
      ],
    };

    expect(() => validateModifierSetExpansionOrder(resetting)).toThrow(
      /set "base" is re-expanded after modifier "motion"/,
    );
  });

  test('allows a modifier-only set when its token paths exist in an unrelated base set', () => {
    const contextOnly: ResolverDocument = {
      version: '2025.10',
      sets: {
        foundation: { sources: [{ $ref: 'base.json' }] },
        lightOverrides: { sources: [{ $ref: 'light.json' }] },
      },
      modifiers: {
        theme: { contexts: { light: [{ $ref: '#/sets/lightOverrides' }] } },
      },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documents = new Map([
      ['base.json', { color: { $type: 'color', $value: 'red' } }],
      ['light.json', { color: { $type: 'color', $value: 'blue' } }],
    ]);

    expect(() => validateModifierTokenPaths(contextOnly, documents)).not.toThrow();
  });

  test('allows a modifier to override a token inherited through base $extends', () => {
    const inherited: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.json' }] } } },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documents = new Map([
      [
        'base.json',
        {
          foundation: {
            $type: 'color' as const,
            accent: { $value: 'red' },
          },
          themed: { $extends: '{foundation}' },
        },
      ],
      ['light.json', { themed: { accent: { $value: 'blue' } } }],
    ]);

    expect(() => validateModifierTokenPaths(inherited, documents)).not.toThrow();
  });

  test('preserves an empty document-root token path', () => {
    const rootToken: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.json' }] } } },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documents = new Map([
      ['base.json', { $type: 'color' as const, $value: 'red' }],
      ['light.json', { $type: 'color' as const, $value: 'blue' }],
    ]);

    expect(() => validateModifierTokenPaths(rootToken, documents)).not.toThrow();
  });

  test('allows modifier token paths introduced by $extends', () => {
    const inherited: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.json' }] } } },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documents = new Map([
      [
        'base.json',
        {
          foundation: {
            accent: { $type: 'color' as const, $value: 'red' },
          },
        },
      ],
      ['light.json', { themed: { $extends: '{foundation}' } }],
    ]);

    expect(() => validateModifierTokenPaths(inherited, documents)).toThrow(
      /override token "themed.accent" has no matching base token/,
    );
  });

  test('rejects a modifier token path with no base declaration', () => {
    const missingBase: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.json' }] } } },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documents = new Map([
      ['base.json', { color: { $type: 'color', $value: 'red' } }],
      ['light.json', { missing: { $type: 'color', $value: 'blue' } }],
    ]);

    expect(() => validateModifierTokenPaths(missingBase, documents)).toThrow(
      /override token "missing" has no matching base token/,
    );
  });

  test('rejects modifier group metadata that changes an inherited base token', () => {
    const metadataOnly: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.json' }] } } },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documents = new Map([
      ['base.json', { typography: { $type: 'fontFamily', normal: { $value: 'normal' } } }],
      ['light.json', { typography: { $type: 'fontWeight' } }],
    ]);

    expect(() => validateModifierTokenPaths(metadataOnly, documents)).toThrow(
      /group metadata affects base token "typography\.normal" without an explicit override/,
    );
  });
});

describe('buildContextSourcesIndex keys are collision-free', () => {
  test('a modifier/context split that would collide under any single-string-key delimiter still resolves correctly', () => {
    // Modifier "a" context "b:c" and modifier "a:b" context "c" concatenate
    // to the same string under ANY fixed delimiter -- a single-map string
    // key cannot distinguish them no matter which separator is chosen. Two-
    // level indexing has no joint-key space to collide in.
    const sourcesForAB = [{ $ref: 'sets/a-bc.tokens.json' }];
    const sourcesForABC = [{ $ref: 'sets/ab-c.tokens.json' }];
    const index = buildContextSourcesIndex([
      { modifierName: 'a', contextName: 'b:c', sources: sourcesForAB },
      { modifierName: 'a:b', contextName: 'c', sources: sourcesForABC },
    ]);

    expect(index.get('a')?.get('b:c')).toEqual(sourcesForAB);
    expect(index.get('a:b')?.get('c')).toEqual(sourcesForABC);
    // Neither entry leaked into the other modifier's namespace.
    expect(index.get('a')?.get('c')).toBeUndefined();
    expect(index.get('a:b')?.get('b:c')).toBeUndefined();
  });

  test('multiple contexts under one modifier and multiple modifiers all coexist', () => {
    const light = [{ $ref: 'sets/light.tokens.json' }];
    const dark = [{ $ref: 'sets/dark.tokens.json' }];
    const reduced = [{ $ref: 'sets/reduced.tokens.json' }];
    const index = buildContextSourcesIndex([
      { modifierName: 'theme', contextName: 'light', sources: light },
      { modifierName: 'theme', contextName: 'dark', sources: dark },
      { modifierName: 'motion', contextName: 'reduced', sources: reduced },
    ]);

    expect(index.get('theme')?.get('light')).toEqual(light);
    expect(index.get('theme')?.get('dark')).toEqual(dark);
    expect(index.get('motion')?.get('reduced')).toEqual(reduced);
  });
});
