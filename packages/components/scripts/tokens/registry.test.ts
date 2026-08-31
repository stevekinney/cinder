/**
 * Regression tests for the CIN-30 review round targeting `registry.ts` --
 * the SHARED extraction module CIN-31/32/34 all build on, so a defect here
 * corrupts every later stage silently. Each test in this file targets one
 * finding:
 *
 *   - A1: `buildBaseIndex` must enforce the same `assertUniqueCssProperties`
 *     invariant `buildTokensBaseCss` enforces, so a caller that reaches the
 *     registry WITHOUT going through `tokens:generate` first (a test, a
 *     future CIN-31/32/34 consumer) can't silently accept a conflicting
 *     `cssProperty` mapping.
 *   - A2: `cssPropertyToPath` must resolve a `cssProperty` shared by more than
 *     one path (the `$extends`-inherited-verbatim case `assertUniqueCssProperties`
 *     deliberately permits) to a single, DETERMINISTIC path -- the first in
 *     corpus traversal order, not whichever happened to be assigned last --
 *     and `cssPropertyToPaths` must expose the full list.
 *   - A3: every string-keyed index the registry builds must tolerate a
 *     `__proto__` token path (a case `resolve.test.ts` already supports) and
 *     a free-form `category`/`component` extension value that collides with
 *     an `Object.prototype` member name, without silently dropping data or
 *     throwing.
 *   - A4: the public/private prefix guard must check each namespace
 *     POSITIVELY. The two prefixes are disjoint, so deriving the public case
 *     from `!startsWith('--_cinder-')` admitted a third namespace entirely.
 *   - A5: the `cssProperty` grammar must match what
 *     `tokens-doc-drift.test.ts` parses back. CSS permits uppercase and
 *     underscores; that parser's row pattern does not, so a token using them
 *     would generate fine and then be reported as MISSING by the drift gate.
 *
 * None of these fixtures touch the real corpus under `src/tokens/`, so a fix
 * here can never change what `tokens:generate` emits for the committed
 * files.
 */

import { describe, expect, test } from 'bun:test';

import { buildBaseIndex, buildTokenRegistryFromIndexes, themeAwarePaths } from './registry.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

/** Minimal resolver with a single `foundation` set and no modifiers -- every
 * fixture in this file only needs base-scope tokens, matching the smallest
 * shape `buildBaseIndex`/`themeAwarePaths` accept. */
function fixtureResolver(): ResolverDocument {
  return {
    version: '2025.10',
    sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/foundation' }],
  };
}

function fixtureDocuments(baseDocument: TokenDocument): Map<string, TokenDocument> {
  return new Map([['base.json', baseDocument]]);
}

describe('A1: buildBaseIndex enforces assertUniqueCssProperties', () => {
  test('rejects two sibling tokens claiming one cssProperty with conflicting values', () => {
    // Two ordinary (non-$extends) tokens sharing a cssProperty with DIFFERENT
    // values -- exactly what assertUniqueCssProperties rejects when
    // buildTokensBaseCss calls it, but pre-fix buildBaseIndex skipped the
    // call entirely and returned this corrupt index without complaint.
    const baseDocument: TokenDocument = {
      space: {
        $type: 'dimension',
        one: {
          $value: { value: 1, unit: 'rem' },
          $extensions: {
            'com.lostgradient.cinder': { cssProperty: '--cinder-test-space', public: true },
          },
        },
        uno: {
          $value: { value: 2, unit: 'rem' },
          $extensions: {
            'com.lostgradient.cinder': { cssProperty: '--cinder-test-space', public: true },
          },
        },
      },
    };

    expect(() => buildBaseIndex(fixtureResolver(), fixtureDocuments(baseDocument))).toThrow(
      /--cinder-test-space is claimed with conflicting values by space\.one, space\.uno/,
    );
  });
});

describe('A2: cssPropertyToPath is a deterministic canonical path, and cssPropertyToPaths lists every claimant', () => {
  function extendsVerbatimFixture(): TokenDocument {
    return {
      foundation: {
        $type: 'dimension',
        swatch: {
          $value: { value: 1, unit: 'rem' },
          $extensions: {
            'com.lostgradient.cinder': { cssProperty: '--cinder-test-swatch', public: true },
          },
        },
      },
      themed: {
        // Inherits "swatch" -- including its cssProperty and value -- verbatim.
        // Post-expansion, two paths ("foundation.swatch" and "themed.swatch")
        // claim the same cssProperty with an IDENTICAL declaration, which
        // assertUniqueCssProperties deliberately permits.
        $extends: '{foundation}',
      },
    };
  }

  test('cssPropertyToPath resolves to the FIRST path in corpus traversal order', () => {
    const resolver = fixtureResolver();
    const documentsByPath = fixtureDocuments(extendsVerbatimFixture());
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    const registry = buildTokenRegistryFromIndexes(
      baseIndex,
      themeAwarePaths(resolver, documentsByPath),
    );

    // Sanity: both paths really did land in the base index, sharing the
    // cssProperty, so this test is actually exercising the multi-claimant
    // case and not silently degenerating to the single-claimant case.
    const claimants = registry.entries
      .filter((entry) => entry.cssProperty === '--cinder-test-swatch')
      .map((entry) => entry.path)
      .toSorted();
    expect(claimants).toEqual(['foundation.swatch', 'themed.swatch']);

    // "foundation.swatch" is collected before "themed.swatch" in corpus
    // traversal order (foundation is declared first in the document). Pre-fix,
    // cssPropertyToPath was last-write-wins and returned "themed.swatch" here
    // instead.
    expect(registry.cssPropertyToPath['--cinder-test-swatch']).toBe('foundation.swatch');
  });

  test('cssPropertyToPaths exposes every path that claims the cssProperty, in traversal order', () => {
    const resolver = fixtureResolver();
    const documentsByPath = fixtureDocuments(extendsVerbatimFixture());
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    const registry = buildTokenRegistryFromIndexes(
      baseIndex,
      themeAwarePaths(resolver, documentsByPath),
    );

    expect(registry.cssPropertyToPaths['--cinder-test-swatch']).toEqual([
      'foundation.swatch',
      'themed.swatch',
    ]);
    // The canonical single-path map always agrees with the first entry of the
    // full-list map.
    expect(registry.cssPropertyToPaths['--cinder-test-swatch']?.[0]).toBe(
      registry.cssPropertyToPath['--cinder-test-swatch'],
    );
  });
});

describe('A3: registry indexes tolerate __proto__ keys instead of corrupting silently', () => {
  test('a token literally named __proto__ survives pathToCssProperty / cssPropertyToPath', () => {
    // JSON.parse (not an object literal) is required to produce a genuine
    // own property named "__proto__" -- see resolve.test.ts's "retains
    // tokens named __proto__" tests, which document the same distinction.
    // An object literal with a `__proto__` key sets the prototype instead of
    // creating a property, which would not exercise this bug at all.
    const baseDocument = JSON.parse(
      '{"$type":"dimension","__proto__":{"$value":{"value":1,"unit":"rem"},' +
        '"$extensions":{"com.lostgradient.cinder":{"cssProperty":"--cinder-test-proto-token","public":true}}}}',
    ) as TokenDocument;

    const resolver = fixtureResolver();
    const documentsByPath = fixtureDocuments(baseDocument);
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    const registry = buildTokenRegistryFromIndexes(
      baseIndex,
      themeAwarePaths(resolver, documentsByPath),
    );

    // Pre-fix: `pathToCssProperty['__proto__'] = ...` on a plain object
    // literal invokes Object.prototype's __proto__ setter (a no-op for a
    // non-object/non-null right-hand side) instead of creating an own
    // property, so the token silently vanishes.
    expect(Object.prototype.hasOwnProperty.call(registry.pathToCssProperty, '__proto__')).toBe(
      true,
    );
    expect(registry.pathToCssProperty['__proto__']).toBe('--cinder-test-proto-token');
    expect(registry.cssPropertyToPath['--cinder-test-proto-token']).toBe('__proto__');

    // JSON.stringify only serializes OWN enumerable properties -- so a
    // dropped own property (the pre-fix bug) also silently vanishes from the
    // committed registry.generated.json, not just from in-memory lookups.
    // The expected value is built via JSON.parse, not an object literal, for
    // the same reason the fixture above is: `{ __proto__: '...' }` as an
    // object-literal sets the prototype (a no-op for a string value) rather
    // than creating an own property, which would make this assertion
    // spuriously pass pre-fix by comparing two equally-empty objects.
    const expected = JSON.parse('{"__proto__":"--cinder-test-proto-token"}') as Record<
      string,
      string
    >;
    expect(JSON.parse(JSON.stringify(registry.pathToCssProperty))).toEqual(expected);
  });

  test('a category named __proto__ groups normally instead of throwing on .push', () => {
    const baseDocument: TokenDocument = {
      swatch: {
        $type: 'dimension',
        $value: { value: 1, unit: 'rem' },
        $extensions: {
          'com.lostgradient.cinder': {
            cssProperty: '--cinder-test-swatch-category',
            // A free-form category value that collides with an
            // Object.prototype member name. Pre-fix, `byCategory['__proto__']`
            // reads back `Object.prototype` (truthy, not undefined) instead
            // of `undefined`, so `??= []` never runs, and the following
            // `.push(...)` throws because `Object.prototype` has no `push`.
            category: '__proto__',
            public: true,
          },
        },
      },
    };

    const resolver = fixtureResolver();
    const documentsByPath = fixtureDocuments(baseDocument);
    const baseIndex = buildBaseIndex(resolver, documentsByPath);

    expect(() =>
      buildTokenRegistryFromIndexes(baseIndex, themeAwarePaths(resolver, documentsByPath)),
    ).not.toThrow();

    const registry = buildTokenRegistryFromIndexes(
      baseIndex,
      themeAwarePaths(resolver, documentsByPath),
    );
    expect(Object.prototype.hasOwnProperty.call(registry.byCategory, '__proto__')).toBe(true);
    expect(registry.byCategory['__proto__']).toEqual(['swatch']);
  });
});

describe('A4: the public/private prefix guard checks each namespace positively', () => {
  function fixtureWithProperty(cssProperty: string, isPublic: boolean): TokenDocument {
    return {
      foundation: {
        $type: 'dimension',
        swatch: {
          $value: { value: 1, unit: 'rem' },
          $extensions: {
            'com.lostgradient.cinder': { cssProperty, public: isPublic },
          },
        },
      },
    };
  }

  function build(cssProperty: string, isPublic: boolean) {
    const resolver = fixtureResolver();
    const documentsByPath = fixtureDocuments(fixtureWithProperty(cssProperty, isPublic));
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    return () =>
      buildTokenRegistryFromIndexes(baseIndex, themeAwarePaths(resolver, documentsByPath));
  }

  // The two namespaces are DISJOINT -- `--_cinder-` diverges from `--cinder-`
  // at the third character -- so "not private" does not imply "public". A
  // guard that derived the public case from `!startsWith('--_cinder-')`
  // admitted any third namespace, and the registry then advertised a name
  // outside the package's contract to every CIN-31/32/34 consumer.
  test('rejects a public token in a third namespace, not just one using the private prefix', () => {
    expect(build('--vendor-foo', true)).toThrow(/"--vendor-foo" does not use the --cinder- prefix/);
  });

  test('rejects a private token in a third namespace', () => {
    expect(build('--vendor-foo', false)).toThrow(
      /"--vendor-foo" does not use the --_cinder- prefix/,
    );
  });

  test('rejects a public token wearing the private prefix', () => {
    expect(build('--_cinder-swatch', true)).toThrow(/does not use the --cinder- prefix/);
  });

  test('rejects a private token wearing the public prefix', () => {
    expect(build('--cinder-swatch', false)).toThrow(/does not use the --_cinder- prefix/);
  });

  test('accepts each flag paired with its own prefix', () => {
    expect(build('--cinder-swatch', true)).not.toThrow();
    expect(build('--_cinder-swatch', false)).not.toThrow();
  });
});

describe('A5: the cssProperty grammar matches what the drift parser can read back', () => {
  function build(cssProperty: string) {
    const resolver = fixtureResolver();
    const documentsByPath = fixtureDocuments({
      foundation: {
        $type: 'dimension',
        swatch: {
          $value: { value: 1, unit: 'rem' },
          $extensions: {
            'com.lostgradient.cinder': { cssProperty, public: true },
          },
        },
      },
    });
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    return () =>
      buildTokenRegistryFromIndexes(baseIndex, themeAwarePaths(resolver, documentsByPath));
  }

  // CSS permits both of these and the generators would emit them, but
  // `tokens-doc-drift.test.ts` parses rows with a `[a-z0-9-]+` suffix. Such a
  // token would generate CSS and a documentation row, then be reported by the
  // required drift gate as MISSING -- an error pointing at the documentation
  // rather than at the name that caused it.
  test('rejects an uppercase character in the suffix', () => {
    expect(build('--cinder-fontAxis')).toThrow(/outside the kebab-case grammar/);
  });

  test('rejects an underscore in the suffix', () => {
    expect(build('--cinder-type-font_axis')).toThrow(/outside the kebab-case grammar/);
  });

  test('rejects a bare prefix with no suffix', () => {
    expect(build('--cinder-')).toThrow(/outside the kebab-case grammar/);
  });

  test('accepts lowercase, digits, and hyphens under either prefix', () => {
    expect(build('--cinder-space-4')).not.toThrow();
  });
});

describe('CIN-464 review: themeAwarePaths expands resolver-internal set references', () => {
  // Regression: `themeAwarePaths` built its `ownDocuments` straight from
  // `themeModifier.contexts[themeName]` via `refsFor`, bypassing the same
  // `#/sets/<name>` expansion `validate-corpus.ts`'s `sourcesForEntry` already
  // applies for the equivalent resolution-order walk. A theme context that
  // referenced a set (rather than only plain document `$ref`s) reached
  // `requireDocument`, which looks for an on-disk document literally named
  // `#/sets/<name>` and throws -- a resolver `tokens:validate` already
  // accepted could not be turned into a registry.
  test('a theme context referencing a set via #/sets/<name> resolves without throwing', () => {
    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: {
        foundation: { sources: [{ $ref: 'base.json' }] },
        lightOverrides: { sources: [{ $ref: 'light.json' }] },
      },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: '#/sets/lightOverrides' }],
            dark: [{ $ref: 'dark.json' }],
          },
        },
      },
      resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
    };
    const documentsByPath = new Map<string, TokenDocument>([
      [
        'base.json',
        {
          color: {
            $type: 'color',
            $value: { colorSpace: 'srgb', components: [0, 0, 0] },
            $extensions: { 'com.lostgradient.cinder': { cssProperty: '--cinder-color' } },
          },
        },
      ],
      ['light.json', { color: { $value: { colorSpace: 'srgb', components: [1, 1, 1] } } }],
      ['dark.json', {}],
    ]);

    const aware = themeAwarePaths(resolver, documentsByPath);
    expect(aware.has('color')).toBe(true);
  });
});
