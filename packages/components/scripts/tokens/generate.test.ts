import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
  assertUniqueCssProperties,
  buildGeneratedOutputs,
  buildResolvedContexts,
  buildTokensBaseCss,
  collectEntries,
  type CorpusEntry,
  documentsForResolutionOrder,
  findDriftedPaths,
  requireDocument,
  resolveAlias,
  resolvedDirectory,
  serializeEntryValue,
  serializeTypedValue,
  tokensBaseCssPath,
} from './generate.ts';
import {
  createValueResolver,
  mergeAndExpandExtends,
  resolveDocuments,
  type ValueResolver,
} from './resolve.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

async function readCommitted(paths: Iterable<string>): Promise<Map<string, string | undefined>> {
  const existing = new Map<string, string | undefined>();
  for (const path of paths) {
    existing.set(
      path,
      await Bun.file(path)
        .text()
        .catch(() => undefined),
    );
  }
  return existing;
}

describe('tokens:generate --check', () => {
  test('passes: freshly generated output matches every committed file', async () => {
    const generated = await buildGeneratedOutputs();
    const existing = await readCommitted(generated.keys());

    // Same set of output paths, not just a coincidentally-empty drift list --
    // catches an output silently going missing from the generator as well as
    // a value drifting.
    expect([...generated.keys()].toSorted()).toEqual([
      tokensBaseCssPath,
      ...['dark-reduced-motion', 'dark', 'light-reduced-motion', 'light']
        .map((name) => join(resolvedDirectory, `${name}.json`))
        .toSorted(),
    ]);

    expect(findDriftedPaths(generated, existing)).toEqual([]);
  });

  test('fails: a manual edit to a committed output is rejected', async () => {
    const generated = await buildGeneratedOutputs();
    const existing = await readCommitted(generated.keys());

    // Mutate a COPY of the committed tokens-base.css content in memory --
    // never touches the real file on disk -- so the comparison sees a
    // hand-edited value that no longer matches what the generator produces.
    const mutatedExisting = new Map(existing);
    const committedCss = mutatedExisting.get(tokensBaseCssPath);
    expect(committedCss).toBeDefined();
    expect(committedCss).toContain('--cinder-space-1: 0.25rem;');
    mutatedExisting.set(
      tokensBaseCssPath,
      committedCss!.replace('--cinder-space-1: 0.25rem;', '--cinder-space-1: 999px;'),
    );

    const drifted = findDriftedPaths(generated, mutatedExisting);

    expect(drifted).toEqual([tokensBaseCssPath]);
  });

  test('fails: a resolved-context JSON file edited by hand is rejected', async () => {
    const generated = await buildGeneratedOutputs();
    const existing = await readCommitted(generated.keys());

    const lightPath = join(resolvedDirectory, 'light.json');
    const mutatedExisting = new Map(existing);
    const committedLight = mutatedExisting.get(lightPath);
    expect(committedLight).toBeDefined();
    mutatedExisting.set(lightPath, `${committedLight}\n`);

    expect(findDriftedPaths(generated, mutatedExisting)).toEqual([lightPath]);
  });
});

// ---------------------------------------------------------------------------
// Regression tests for the ten CIN-29 review findings. Each constructs the
// smallest fixture that isolates the fix -- none touch the real corpus under
// src/tokens/, so a fix here can never change what tokens:generate emits for
// the committed files (verified separately after every fix via `tokens:generate`
// + an empty `git diff --stat` on the generated outputs).
// ---------------------------------------------------------------------------

function colorEntry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    path: 'test.color',
    value: { colorSpace: 'oklch', components: [0.5, 0.1, 250] },
    type: 'color',
    description: undefined,
    cssProperty: '--test-color',
    cssRecipe: undefined,
    ...overrides,
  };
}

describe('A1: the forced-reduced-motion selector is built from its own context', () => {
  function motionFixture() {
    const baseDocument: TokenDocument = {
      duration: {
        $type: 'duration',
        instant: {
          $value: { value: 0, unit: 'ms' },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-duration' } },
        },
      },
    };
    const themeDocument: TokenDocument = {};
    const motionDefaultDocument: TokenDocument = {};
    // The `reduced` and `forced-reduced-motion` contexts deliberately hold
    // DIFFERENT override values -- the real corpus's two motion documents
    // happen to agree today, which is exactly why this bug was silent there.
    const motionReducedDocument: TokenDocument = {
      duration: { $type: 'duration', instant: { $value: { value: 1, unit: 'ms' } } },
    };
    const motionForcedDocument: TokenDocument = {
      duration: { $type: 'duration', instant: { $value: { value: 2, unit: 'ms' } } },
    };

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: 'theme-light.json' }],
            dark: [{ $ref: 'theme-dark.json' }],
          },
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-reduced.json' }],
            'forced-reduced-motion': [{ $ref: 'motion-forced.json' }],
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

    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeDocument],
      ['theme-dark.json', themeDocument],
      ['motion-default.json', motionDefaultDocument],
      ['motion-reduced.json', motionReducedDocument],
      ['motion-forced.json', motionForcedDocument],
    ]);

    return { resolver, documentsByPath };
  }

  test('the data-reduced-motion="on" override uses the forced-reduced-motion context, not reduced', async () => {
    const { resolver, documentsByPath } = motionFixture();
    const css = await buildTokensBaseCss(resolver, documentsByPath);

    const forcedBlock = /:root\[data-reduced-motion='on'\]\s*\{([^}]*)\}/.exec(css)?.[1];
    const mediaBlock = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\{([^}]*)\}\s*\}/.exec(
      css,
    )?.[1];

    expect(forcedBlock).toBeDefined();
    expect(mediaBlock).toBeDefined();

    // The forced block must carry the forced-reduced-motion context's value
    // (2ms), and the media block must keep carrying the reduced context's
    // value (1ms) -- proving the two selectors now read from two different
    // contexts instead of both reading `reduced`.
    expect(forcedBlock).toContain('--test-duration: 2ms;');
    expect(forcedBlock).not.toContain('1ms');
    expect(mediaBlock).toContain('--test-duration: 1ms;');
  });
});

describe('A2: resolved snapshots walk resolutionOrder instead of a hardcoded order', () => {
  test('document assembly order follows resolutionOrder, not a hardcoded [foundation, theme, motion]', () => {
    const baseDocument: TokenDocument = { token: { $type: 'number', $value: 1 } };
    const themeLightDocument: TokenDocument = { token: { $value: 2 } };
    const motionDefaultDocument: TokenDocument = {};

    // resolutionOrder deliberately reverses the sets/foundation and
    // modifiers/theme entries relative to their conventional order, so
    // hardcoded [foundation, theme, motion] assembly and resolutionOrder-driven
    // assembly disagree on which document comes last (and therefore wins the
    // merge for the colliding "token" path).
    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: { contexts: { light: [{ $ref: 'theme-light.json' }] }, default: 'light' },
        motion: { contexts: { default: [{ $ref: 'motion-default.json' }] }, default: 'default' },
      },
      resolutionOrder: [
        { $ref: '#/modifiers/theme' },
        { $ref: '#/sets/foundation' },
        { $ref: '#/modifiers/motion' },
      ],
    };
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeLightDocument],
      ['motion-default.json', motionDefaultDocument],
    ]);

    const documents = documentsForResolutionOrder(resolver, documentsByPath, {
      theme: 'light',
      motion: 'default',
    });

    expect(documents).toEqual([themeLightDocument, baseDocument, motionDefaultDocument]);
  });

  test('a reordered resolutionOrder changes which value wins a resolved snapshot', async () => {
    const baseDocument: TokenDocument = { token: { $type: 'number', $value: 1 } };
    const themeLightDocument: TokenDocument = { token: { $value: 2 } };
    const themeDarkDocument: TokenDocument = { token: { $value: 3 } };
    const motionDefaultDocument: TokenDocument = {};
    const motionReducedDocument: TokenDocument = {};

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: 'theme-light.json' }],
            dark: [{ $ref: 'theme-dark.json' }],
          },
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-reduced.json' }],
          },
          default: 'default',
        },
      },
      // Theme now comes BEFORE foundation, so foundation's value should win
      // for a token both documents define.
      resolutionOrder: [
        { $ref: '#/modifiers/theme' },
        { $ref: '#/sets/foundation' },
        { $ref: '#/modifiers/motion' },
      ],
    };
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeLightDocument],
      ['theme-dark.json', themeDarkDocument],
      ['motion-default.json', motionDefaultDocument],
      ['motion-reduced.json', motionReducedDocument],
    ]);

    const resolved = await buildResolvedContexts(resolver, documentsByPath);
    const lightJson = resolved.get('light');
    expect(lightJson).toBeDefined();
    const parsed = JSON.parse(lightJson!) as Record<string, { $value: unknown }>;

    // foundation's value (1) wins because it now comes AFTER theme in
    // resolutionOrder; a hardcoded [foundation, theme, motion] assembly would
    // have produced 2 (theme's value) instead.
    expect(parsed['token']?.$value).toBe(1);
  });
});

describe('B1: #/ JSON Pointer aliases resolve like {curly} aliases', () => {
  test('a $value: "#/a/b" alias emits var(...) against the target cssProperty', () => {
    const baseIndex = new Map<string, CorpusEntry>([
      ['accent.background', colorEntry({ path: 'accent.background' })],
    ]);
    const pointerEntry: CorpusEntry = {
      path: 'accent.alias',
      value: '#/accent/background',
      type: undefined,
      description: undefined,
      cssProperty: '--test-alias',
      cssRecipe: undefined,
    };
    const curlyEntry: CorpusEntry = { ...pointerEntry, value: '{accent.background}' };

    expect(serializeEntryValue(pointerEntry, baseIndex)).toBe('var(--test-color)');
    expect(serializeEntryValue(curlyEntry, baseIndex)).toBe(
      serializeEntryValue(pointerEntry, baseIndex),
    );
  });

  test('resolveAlias decodes JSON Pointer percent- and tilde-escapes', () => {
    const baseIndex = new Map<string, CorpusEntry>([['a/b', colorEntry({ path: 'a/b' })]]);
    expect(resolveAlias('#/a~1b', baseIndex)).toBe('var(--test-color)');
  });
});

describe('B2: a single shadow object is accepted, not only an array of layers', () => {
  test('a bare shadow object normalizes to the same output as a one-element array', () => {
    const layer = {
      color: { colorSpace: 'oklch', components: [0, 0, 0], alpha: 0.2 },
      offsetX: { value: 0, unit: 'px' },
      offsetY: { value: 1, unit: 'px' },
      blur: { value: 2, unit: 'px' },
      spread: { value: 0, unit: 'px' },
    };

    expect(serializeTypedValue('shadow', layer, 'test.shadow')).toBe(
      serializeTypedValue('shadow', [layer], 'test.shadow'),
    );
    expect(serializeTypedValue('shadow', layer, 'test.shadow')).toBe(
      '0 1px 2px oklch(0% 0 0 / 0.2)',
    );
  });
});

describe('B3: named DTCG font weights are accepted and translated to CSS numbers', () => {
  test('every named weight maps to its OpenType usWeightClass number', () => {
    const expected: Record<string, string> = {
      thin: '100',
      'extra-light': '200',
      light: '300',
      normal: '400',
      medium: '500',
      'semi-bold': '600',
      bold: '700',
      'extra-bold': '800',
      black: '900',
      'extra-black': '950',
    };
    for (const [name, weight] of Object.entries(expected))
      expect(serializeTypedValue('fontWeight', name, 'test.weight')).toBe(weight);
  });

  test('a numeric fontWeight still passes through unchanged', () => {
    expect(serializeTypedValue('fontWeight', 600, 'test.weight')).toBe('600');
  });

  test('an unrecognized fontWeight name is rejected', () => {
    expect(() => serializeTypedValue('fontWeight', 'ultra-bold', 'test.weight')).toThrow();
  });
});

describe('B4: resolver source refs are normalized before document lookup', () => {
  test('a "./"-prefixed ref resolves to the same document as its normalized form', () => {
    const document: TokenDocument = {};
    const documentsByPath = new Map<string, TokenDocument>([
      ['sets/foundation.tokens.json', document],
    ]);

    expect(requireDocument(documentsByPath, './sets/foundation.tokens.json')).toBe(document);
    expect(requireDocument(documentsByPath, 'sets/./foundation.tokens.json')).toBe(document);
  });
});

describe('CIN-464 review: buildTokensBaseCss expands resolver-internal set references', () => {
  // Regression: `buildTokensBaseCss` built `lightDocuments`/`darkDocuments`
  // and both motion override document lists straight from
  // `themeModifier.contexts[...]`/`motionModifier.contexts[...]` via
  // `refsFor`, bypassing the same `#/sets/<name>` expansion
  // `validate-corpus.ts`'s `sourcesForEntry` already applies for the
  // equivalent resolution-order walk (used just below, for `*ScopeDocuments`,
  // via `documentsForResolutionOrder`). A theme or motion context that
  // referenced a set reached `requireDocument`, which looks for an on-disk
  // document literally named `#/sets/<name>` and throws -- a resolver
  // `tokens:validate` already accepted could not be generated.
  test('a theme context referencing a set via #/sets/<name> does not throw', async () => {
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
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-default.json' }],
            'forced-reduced-motion': [{ $ref: 'motion-default.json' }],
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
      [
        'light.json',
        { color: { $type: 'color', $value: { colorSpace: 'srgb', components: [1, 1, 1] } } },
      ],
      ['dark.json', {}],
      ['motion-default.json', {}],
    ]);

    const css = await buildTokensBaseCss(resolver, documentsByPath);
    expect(css).toContain('--cinder-color');
  });
});

describe('C1: isColorValue rejects a malformed color shape instead of serializing NaN%', () => {
  test('a components array with the wrong length throws', () => {
    expect(() =>
      serializeTypedValue('color', { colorSpace: 'oklch', components: [0.5, 0.1] }, 'test.color'),
    ).toThrow();
  });

  test('a non-numeric, non-"none" component throws', () => {
    expect(() =>
      serializeTypedValue(
        'color',
        { colorSpace: 'oklch', components: [0.5, 'bogus', 250] },
        'test.color',
      ),
    ).toThrow();
  });

  test('a well-formed color value still serializes (regression)', () => {
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'oklch', components: [0.5, 0.1, 250] },
        'test.color',
      ),
    ).toBe('oklch(50% 0.1 250)');
  });
});

describe('C2: isCubicBezierValue requires exactly four numbers', () => {
  test('a three-number array throws instead of emitting an invalid cubic-bezier()', () => {
    expect(() => serializeTypedValue('cubicBezier', [0, 0, 0], 'test.ease')).toThrow();
  });

  test('a five-number array also throws', () => {
    expect(() => serializeTypedValue('cubicBezier', [0, 0, 0, 1, 2], 'test.ease')).toThrow();
  });

  test('a well-formed four-number array still serializes (regression)', () => {
    expect(serializeTypedValue('cubicBezier', [0.2, 0, 0, 1], 'test.ease')).toBe(
      'cubic-bezier(0.2, 0, 0, 1)',
    );
  });
});

describe('A3: a non-opaque srgb color is not silently flattened to an opaque hex', () => {
  test('alpha !== 1 falls back to the color() component form instead of dropping alpha through hex', () => {
    const serialized = serializeTypedValue(
      'color',
      { colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000', alpha: 0.4 },
      'test.color',
    );
    expect(serialized).toBe('color(srgb 1 0 0 / 0.4)');
    expect(serialized).not.toContain('#ff0000');
  });

  test('alpha === 1 or absent still collapses to hex (regression)', () => {
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'srgb', components: [1, 1, 1], hex: '#ffffff' },
        'test.color',
      ),
    ).toBe('#fff');
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'srgb', components: [1, 1, 1], hex: '#ffffff', alpha: 1 },
        'test.color',
      ),
    ).toBe('#fff');
  });

  test('alpha === 0 still collapses to the transparent keyword (regression)', () => {
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0 },
        'test.color',
      ),
    ).toBe('transparent');
  });
});

describe('A4: font-family names requiring escaping are quoted, not emitted bare', () => {
  test('a comma-containing name with no space is quoted so it does not parse as two families', () => {
    // No space in "Acme,Sans" -- the old `name.includes(' ')` check would
    // leave this bare, which the CSS parser reads as TWO family names
    // ("Acme" and "Sans") instead of one.
    expect(serializeTypedValue('fontFamily', ['Acme,Sans', 'sans-serif'], 'test.font')).toBe(
      "'Acme,Sans', sans-serif",
    );
  });

  test('the finding\'s own example ("ACME, Inc") is quoted', () => {
    expect(serializeTypedValue('fontFamily', ['ACME, Inc', 'sans-serif'], 'test.font')).toBe(
      "'ACME, Inc', sans-serif",
    );
  });

  test('an apostrophe in a name is escaped inside the quoted string', () => {
    expect(serializeTypedValue('fontFamily', ["O'Reilly Sans"], 'test.font')).toBe(
      "'O\\'Reilly Sans'",
    );
  });

  test('space-containing names stay quoted and generic keywords stay bare (regression, matches committed output)', () => {
    expect(
      serializeTypedValue(
        'fontFamily',
        ['system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
        'test.font',
      ),
    ).toBe("system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif");
  });
});

// ---------------------------------------------------------------------------
// Regression tests for the five follow-on CIN-29 review findings.
// ---------------------------------------------------------------------------

describe('D1: an oklch alpha of "none" is emitted, not silently dropped', () => {
  test('alpha: "none" appears in the serialized oklch() value', () => {
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'oklch', components: [0.5, 0.1, 250], alpha: 'none' },
        'test.color',
      ),
    ).toBe('oklch(50% 0.1 250 / none)');
  });

  test('a numeric alpha still serializes (regression)', () => {
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'oklch', components: [0.5, 0.1, 250], alpha: 0.5 },
        'test.color',
      ),
    ).toBe('oklch(50% 0.1 250 / 0.5)');
  });

  test('an absent alpha still omits the alpha segment (regression)', () => {
    expect(
      serializeTypedValue(
        'color',
        { colorSpace: 'oklch', components: [0.5, 0.1, 250] },
        'test.color',
      ),
    ).toBe('oklch(50% 0.1 250)');
  });
});

describe('D2: isShadowLayerArray enforces inset is boolean when present, not merely truthy', () => {
  function layer(inset: unknown) {
    return {
      color: { colorSpace: 'oklch', components: [0, 0, 0] },
      offsetX: { value: 0, unit: 'px' },
      offsetY: { value: 1, unit: 'px' },
      blur: { value: 2, unit: 'px' },
      spread: { value: 0, unit: 'px' },
      inset,
    };
  }

  test('a non-boolean (string) inset throws instead of serializing the literal "inset" keyword', () => {
    // A truthy-but-non-boolean "inset" (e.g. authored as a string "true" by mistake) must be
    // rejected, not treated as truthy -- the old `layer.inset ? 'inset' : undefined` check in
    // formatShadow would otherwise silently accept it and emit the "inset" keyword.
    expect(() => serializeTypedValue('shadow', layer('true'), 'test.shadow')).toThrow();
  });

  test('inset: true still serializes the "inset" keyword (regression)', () => {
    expect(serializeTypedValue('shadow', layer(true), 'test.shadow')).toBe(
      'inset 0 1px 2px oklch(0% 0 0)',
    );
  });

  test('inset: false still omits the "inset" keyword (regression)', () => {
    expect(serializeTypedValue('shadow', layer(false), 'test.shadow')).toBe(
      '0 1px 2px oklch(0% 0 0)',
    );
  });

  test('an absent inset still omits the "inset" keyword (regression)', () => {
    const { inset: _inset, ...withoutInset } = layer(false);
    expect(serializeTypedValue('shadow', withoutInset, 'test.shadow')).toBe(
      '0 1px 2px oklch(0% 0 0)',
    );
  });
});

describe('D3: a resolved-context combo fills an unnamed modifier from its declared default', () => {
  function thirdModifierFixture(density: { default?: string }) {
    const baseDocument: TokenDocument = { token: { $type: 'number', $value: 1 } };
    const themeDocument: TokenDocument = {};
    const motionDocument: TokenDocument = {};
    const densityCozyDocument: TokenDocument = { token: { $value: 2 } };
    const densityCompactDocument: TokenDocument = { token: { $value: 3 } };

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: { light: [{ $ref: 'theme.json' }], dark: [{ $ref: 'theme.json' }] },
          default: 'light',
        },
        motion: {
          contexts: { default: [{ $ref: 'motion.json' }], reduced: [{ $ref: 'motion.json' }] },
          default: 'default',
        },
        density: {
          contexts: {
            cozy: [{ $ref: 'density-cozy.json' }],
            compact: [{ $ref: 'density-compact.json' }],
          },
          ...(density.default !== undefined ? { default: density.default } : {}),
        },
      },
      resolutionOrder: [
        { $ref: '#/sets/foundation' },
        { $ref: '#/modifiers/theme' },
        { $ref: '#/modifiers/motion' },
        { $ref: '#/modifiers/density' },
      ],
    };
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme.json', themeDocument],
      ['motion.json', motionDocument],
      ['density-cozy.json', densityCozyDocument],
      ['density-compact.json', densityCompactDocument],
    ]);
    return { resolver, documentsByPath };
  }

  test("a combo that does not name density resolves it from density's own declared default", async () => {
    const { resolver, documentsByPath } = thirdModifierFixture({ default: 'cozy' });

    const resolved = await buildResolvedContexts(resolver, documentsByPath);
    const lightJson = resolved.get('light');
    expect(lightJson).toBeDefined();
    const parsed = JSON.parse(lightJson!) as Record<string, { $value: unknown }>;

    // "density" isn't named by any RESOLVED_CONTEXT_COMBO -- its declared default ("cozy",
    // value 2) must be the one that wins over "compact" (value 3).
    expect(parsed['token']?.$value).toBe(2);
  });

  test('a combo that does not name density AND density has no declared default fails with a named error', async () => {
    const { resolver, documentsByPath } = thirdModifierFixture({});

    await expect(buildResolvedContexts(resolver, documentsByPath)).rejects.toThrow(/density/);
  });
});

describe('D4: references nested inside a composite value are resolved, not serialized literally', () => {
  test('a shadow inset resolved via a JSON Pointer to false is NOT emitted as the "inset" keyword', () => {
    const document: TokenDocument = {
      test: {
        'other-shadow': {
          $type: 'shadow',
          $value: {
            color: { colorSpace: 'oklch', components: [0, 0, 0] },
            offsetX: { value: 0, unit: 'px' },
            offsetY: { value: 0, unit: 'px' },
            blur: { value: 0, unit: 'px' },
            spread: { value: 0, unit: 'px' },
            inset: false,
          },
        },
        shadow: {
          $type: 'shadow',
          $value: {
            color: { colorSpace: 'oklch', components: [0, 0, 0] },
            offsetX: { value: 0, unit: 'px' },
            offsetY: { value: 1, unit: 'px' },
            blur: { value: 2, unit: 'px' },
            spread: { value: 0, unit: 'px' },
            // JSON Pointer into ANOTHER token's `inset` property -- not a whole-token alias,
            // so `serializeEntryValue`'s top-level `isAliasReference(entry.value)` check never
            // fires; this reference lives one level inside the composite.
            inset: '#/test/other-shadow/inset',
          },
        },
      },
    };
    const resolver = createValueResolver([document]);
    const shadowValue = (document['test'] as Record<string, { $value: unknown }>)['shadow']!.$value;

    const serialized = serializeTypedValue('shadow', shadowValue, 'test.shadow', resolver);

    // Pre-fix, the raw string "#/test/other-shadow/inset" is non-empty and therefore truthy,
    // so the old `layer.inset ? 'inset' : undefined` check would emit the "inset" keyword --
    // silently inverting a token that resolves to `false`.
    expect(serialized).not.toContain('inset');
    expect(serialized).toBe('0 1px 2px oklch(0% 0 0)');
  });

  test('a color component holding a reference resolves instead of being rejected', () => {
    const document: TokenDocument = {
      test: {
        'lightness-value': { $type: 'number', $value: 0.6 },
        color: {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: ['{test.lightness-value}', 0.1, 250] },
        },
      },
    };
    const resolver = createValueResolver([document]);
    const colorValue = (document['test'] as Record<string, { $value: unknown }>)['color']!.$value;

    // Pre-fix, isColorComponent rejects a reference string outright (it accepts only `number`
    // or `'none'`), so isColorValue returns false and this throws "not a valid color" even
    // though validate.ts's isReference check explicitly permits a reference at this position.
    const serialized = serializeTypedValue('color', colorValue, 'test.color', resolver);
    expect(serialized).toBe('oklch(60% 0.1 250)');
  });

  test('a border color reference resolves to the referenced color literal (covers a non-shadow, non-color composite member)', () => {
    const document: TokenDocument = {
      test: {
        'border-color': {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: [0.2, 0.05, 30] },
        },
        border: {
          $type: 'border',
          $value: {
            color: '{test.border-color}',
            width: { value: 1, unit: 'px' },
            style: 'solid',
          },
        },
      },
    };
    const resolver = createValueResolver([document]);
    const borderValue = (document['test'] as Record<string, { $value: unknown }>)['border']!
      .$value as Record<string, unknown>;

    // `border` has no direct CSS serialization in serializeTypedValue (it goes through
    // cssRecipe in the real corpus), but resolving its nested `color` reference is exactly the
    // same reference machinery -- assert on the resolver's output directly.
    expect(resolver(borderValue)).toEqual({
      color: { colorSpace: 'oklch', components: [0.2, 0.05, 30] },
      width: { value: 1, unit: 'px' },
      style: 'solid',
    });
  });
});

// ---------------------------------------------------------------------------
// Regression tests for the three CIN-29 round-3 review findings.
// ---------------------------------------------------------------------------

describe('E1: a nested reference inside an override context resolves against that context, not just the base', () => {
  function overrideResolverFixture() {
    // A base "lightness" token and a base "composite" color whose lightness component is a
    // NESTED reference (not a whole-token alias) to it. The dark theme context overrides BOTH
    // "lightness" (to a different value) AND "composite" (with the identical nested reference)
    // -- so a correct per-context resolver must resolve "composite"'s reference against dark's
    // own "lightness" override, not the base/foundation value.
    const baseDocument: TokenDocument = {
      test: {
        lightness: {
          $type: 'number',
          $value: 0.3,
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-lightness' } },
        },
        composite: {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: ['{test.lightness}', 0.1, 250] },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-composite' } },
        },
      },
    };
    const themeLightDocument: TokenDocument = {};
    const themeDarkDocument: TokenDocument = {
      test: {
        lightness: { $type: 'number', $value: 0.8 },
        composite: {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: ['{test.lightness}', 0.1, 250] },
        },
      },
    };
    const motionDefaultDocument: TokenDocument = {};

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: 'theme-light.json' }],
            dark: [{ $ref: 'theme-dark.json' }],
          },
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-reduced.json' }],
            'forced-reduced-motion': [{ $ref: 'motion-forced.json' }],
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
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeLightDocument],
      ['theme-dark.json', themeDarkDocument],
      ['motion-default.json', motionDefaultDocument],
      ['motion-reduced.json', motionDefaultDocument],
      ['motion-forced.json', motionDefaultDocument],
    ]);

    return { resolver, documentsByPath };
  }

  test('the dark block resolves the nested reference against the dark override, not the base value', async () => {
    const { resolver, documentsByPath } = overrideResolverFixture();
    const css = await buildTokensBaseCss(resolver, documentsByPath);

    // Two selectors contain the literal substring `[data-theme='dark']` -- the structural
    // `:root[data-theme='dark'] { color-scheme: dark; }` block (declared first, no
    // declarations) and the actual override block further down. Take the second match.
    const darkBlocks = [...css.matchAll(/\[data-theme='dark'\]\s*\{([^}]*)\}/g)];
    expect(darkBlocks.length).toBe(2);
    const darkBlock = darkBlocks[1]?.[1];
    expect(darkBlock).toBeDefined();

    // Pre-fix, a resolver shared across all contexts and built from `baseDocuments` alone
    // resolves `{test.lightness}` to the BASE value (0.3 -> 30%) even inside the dark block.
    // Post-fix, it must resolve to dark's own override (0.8 -> 80%).
    expect(darkBlock).toContain('--test-composite: oklch(80% 0.1 250);');
    expect(darkBlock).not.toContain('30%');
  });
});

describe('E2: CSS-wide keywords are quoted in font-family output instead of emitted bare', () => {
  test('"inherit" as a font-family name is quoted, not emitted as the bare cascade keyword', () => {
    // Pre-fix, `inherit` matches SAFE_UNQUOTED_FONT_FAMILY_NAME (it's a valid bare
    // <custom-ident>) and is emitted bare -- which invokes CSS's `inherit` cascade behavior
    // instead of naming a font called "inherit".
    expect(serializeTypedValue('fontFamily', ['inherit'], 'test.font')).toBe("'inherit'");
  });

  test('every CSS-wide keyword is quoted, checked case-insensitively', () => {
    // "Unset" and "REVERT" prove the check is case-insensitive -- the keyword is matched
    // regardless of casing, but the ORIGINAL casing is preserved inside the quotes.
    for (const keyword of ['initial', 'Unset', 'REVERT', 'revert-layer']) {
      expect(serializeTypedValue('fontFamily', [keyword], 'test.font')).toBe(`'${keyword}'`);
    }
  });

  test('generic-family keywords stay bare (regression)', () => {
    expect(serializeTypedValue('fontFamily', ['sans-serif'], 'test.font')).toBe('sans-serif');
    expect(serializeTypedValue('fontFamily', ['system-ui'], 'test.font')).toBe('system-ui');
  });

  test('an ordinary safe identifier stays bare (regression)', () => {
    expect(serializeTypedValue('fontFamily', ['Roboto'], 'test.font')).toBe('Roboto');
  });
});

describe('E3: $extends group inheritance is applied before entries are collected', () => {
  function extendsFixture() {
    const baseDocument: TokenDocument = {
      foundation: {
        $type: 'color',
        swatch: {
          $value: { colorSpace: 'oklch', components: [0.4, 0.08, 200] },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-inherited-swatch' } },
        },
      },
      themed: {
        // No own $type -- must inherit "color" from the extended group once $extends expands.
        $extends: '{foundation}',
        accent: {
          $value: { colorSpace: 'oklch', components: [0.6, 0.12, 20] },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-local-accent' } },
        },
        // "swatch" is deliberately NOT redefined here -- it must be inherited from "foundation".
      },
    };
    const themeLightDocument: TokenDocument = {};
    const themeDarkDocument: TokenDocument = {};
    const motionDefaultDocument: TokenDocument = {};

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: 'theme-light.json' }],
            dark: [{ $ref: 'theme-dark.json' }],
          },
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-reduced.json' }],
            'forced-reduced-motion': [{ $ref: 'motion-forced.json' }],
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
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeLightDocument],
      ['theme-dark.json', themeDarkDocument],
      ['motion-default.json', motionDefaultDocument],
      ['motion-reduced.json', motionDefaultDocument],
      ['motion-forced.json', motionDefaultDocument],
    ]);

    return { resolver, documentsByPath };
  }

  test('a locally overridden member gets the extended $type, and an inherited member is emitted', async () => {
    const { resolver, documentsByPath } = extendsFixture();
    const css = await buildTokensBaseCss(resolver, documentsByPath);

    const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1];
    expect(rootBlock).toBeDefined();

    // The locally-defined "accent" member has no own $type -- pre-fix, "themed" never gets
    // $extends applied, so its $type stays undefined, and generation throws before this
    // declaration is ever produced. Post-fix it resolves the inherited "color" $type and
    // serializes normally.
    expect(rootBlock).toContain('--test-local-accent: oklch(60% 0.12 20);');

    // "swatch" is never redefined under "themed" -- pre-fix it is absent from the output
    // entirely (only reachable via the un-expanded "foundation" path). Post-fix, $extends
    // copies it in, so the SAME value is now reachable under BOTH the "foundation" origin
    // token and the "themed" group that inherited it.
    const swatchDeclarationCount = (
      rootBlock!.match(/--test-inherited-swatch: oklch\(40% 0\.08 200\);/g) ?? []
    ).length;
    expect(swatchDeclarationCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Regression tests for the follow-up CIN-29 review round: two defects
// introduced by the E1/E3 fixes above (each context composing its OWN
// documents in isolation, for BOTH $extends expansion and nested-reference
// resolution), plus one independent JSON-Pointer defect. None touch the real
// corpus under src/tokens/, so a fix here can never change what
// tokens:generate emits for the committed files.
// ---------------------------------------------------------------------------

describe("F1: an override context's $extends can reference a foundation group, not just its own document", () => {
  function extendsAcrossDocumentsFixture() {
    const baseDocument: TokenDocument = {
      palette: {
        $type: 'color',
        accent: {
          $value: { colorSpace: 'oklch', components: [0.4, 0.08, 200] },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-palette-accent' } },
        },
      },
      'alt-palette': {
        $type: 'color',
        accent: {
          $value: { colorSpace: 'oklch', components: [0.7, 0.15, 30] },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-alt-palette-accent' } },
        },
      },
    };
    const themeLightDocument: TokenDocument = {};
    // Dark's own group is named "palette" -- matching foundation's own token path, so
    // `renderOverrideDeclarations` finds foundation's cssProperty for it -- but `$extends` a
    // DIFFERENT foundation group, "alt-palette". Naming it after its OWN group would make the
    // `$extends` lookup find dark's own (still-expanding) group and report a circular reference
    // instead of exercising the cross-document lookup this test is about.
    const themeDarkDocument: TokenDocument = {
      palette: { $extends: '{alt-palette}' },
    };
    const motionDefaultDocument: TokenDocument = {};

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: 'theme-light.json' }],
            dark: [{ $ref: 'theme-dark.json' }],
          },
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-reduced.json' }],
            'forced-reduced-motion': [{ $ref: 'motion-forced.json' }],
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
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeLightDocument],
      ['theme-dark.json', themeDarkDocument],
      ['motion-default.json', motionDefaultDocument],
      ['motion-reduced.json', motionDefaultDocument],
      ['motion-forced.json', motionDefaultDocument],
    ]);

    return { resolver, documentsByPath };
  }

  test("the dark block emits the extended group's member instead of generation throwing", async () => {
    const { resolver, documentsByPath } = extendsAcrossDocumentsFixture();
    const css = await buildTokensBaseCss(resolver, documentsByPath);

    const darkBlocks = [...css.matchAll(/\[data-theme='dark'\]\s*\{([^}]*)\}/g)];
    expect(darkBlocks.length).toBe(2);
    const darkBlock = darkBlocks[1]?.[1];
    expect(darkBlock).toBeDefined();

    // Dark's own "palette" group never defines "accent" itself -- it only reaches it through
    // `$extends: "{alt-palette}"`, a group that lives in the FOUNDATION document, not dark's own.
    // Pre-fix, dark's own document is expanded in isolation, so "alt-palette" is not a group
    // `$extends` can find there, and generation throws before this assertion is ever reached.
    expect(darkBlock).toContain('--test-palette-accent: oklch(70% 0.15 30);');
  });
});

describe('F2: a nested reference inside a motion override resolves against the theme context too, not just the base', () => {
  function motionNestedReferenceFixture() {
    // A base "lightness" number and a base "composite" color whose lightness component is a
    // NESTED reference to it. BOTH themes override "lightness" to the SAME new value (0.9) --
    // the bug this isolates is that the reduced-motion resolver saw NO theme document AT ALL
    // (not merely the wrong one), so making light and dark agree keeps the expected value the
    // same however the "other axis" ends up getting composed, while still proving the fix: only
    // seeing base-plus-motion resolves the nested reference to the untouched base value (0.3).
    const baseDocument: TokenDocument = {
      test: {
        lightness: {
          $type: 'number',
          $value: 0.3,
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-lightness' } },
        },
        composite: {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: ['{test.lightness}', 0.1, 250] },
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-composite' } },
        },
      },
    };
    const themeLightDocument: TokenDocument = {
      test: { lightness: { $type: 'number', $value: 0.9 } },
    };
    const themeDarkDocument: TokenDocument = {
      test: { lightness: { $type: 'number', $value: 0.9 } },
    };
    const motionDefaultDocument: TokenDocument = {};
    // "reduced" overrides ONLY "composite" -- it deliberately does NOT redefine "lightness"
    // itself, so the nested `{test.lightness}` reference inside it can only resolve correctly by
    // seeing a THEME document too, not by the motion context redefining lightness on its own.
    const motionReducedDocument: TokenDocument = {
      test: {
        composite: {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: ['{test.lightness}', 0.1, 250] },
        },
      },
    };
    const motionForcedDocument: TokenDocument = {};

    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {
        theme: {
          contexts: {
            light: [{ $ref: 'theme-light.json' }],
            dark: [{ $ref: 'theme-dark.json' }],
          },
          default: 'light',
        },
        motion: {
          contexts: {
            default: [{ $ref: 'motion-default.json' }],
            reduced: [{ $ref: 'motion-reduced.json' }],
            'forced-reduced-motion': [{ $ref: 'motion-forced.json' }],
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
    const documentsByPath = new Map<string, TokenDocument>([
      ['base.json', baseDocument],
      ['theme-light.json', themeLightDocument],
      ['theme-dark.json', themeDarkDocument],
      ['motion-default.json', motionDefaultDocument],
      ['motion-reduced.json', motionReducedDocument],
      ['motion-forced.json', motionForcedDocument],
    ]);

    return { resolver, documentsByPath };
  }

  test("the reduced-motion CSS block agrees with the generator's own dark+reduced resolved combo", async () => {
    const { resolver, documentsByPath } = motionNestedReferenceFixture();

    const css = await buildTokensBaseCss(resolver, documentsByPath);
    const mediaBlock = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\{([^}]*)\}\s*\}/.exec(
      css,
    )?.[1];
    expect(mediaBlock).toBeDefined();
    const declaredValue = /--test-composite:\s*([^;]+);/.exec(mediaBlock!)?.[1];
    expect(declaredValue).toBeDefined();

    // The generator's OWN OTHER output for the exact combo the media block is theoretically
    // standing in for (dark theme, reduced motion): resolve the same documents `tokens:validate`
    // would resolve for that full combo (`documentsForResolutionOrder` + `resolveDocuments`, the
    // SAME machinery `buildResolvedContexts` uses for the committed JSON snapshots), and
    // serialize the fully-resolved value the same way `buildTokensBaseCss` does. Pre-fix, the CSS
    // side bakes in the untouched FOUNDATION value (30%) because the resolver it used never saw
    // either theme document; post-fix the two agree.
    const combo = documentsForResolutionOrder(resolver, documentsByPath, {
      theme: 'dark',
      motion: 'reduced',
    });
    const resolved = resolveDocuments(combo);
    const resolvedComposite = resolved['test.composite'];
    expect(resolvedComposite).toBeDefined();
    const expectedValue = serializeTypedValue('color', resolvedComposite!.$value, 'test.composite');

    expect(declaredValue).toBe(expectedValue);
    expect(declaredValue).not.toContain('30%');
  });
});

describe('F3: a property-form JSON Pointer whose terminal segment is $value resolves like the whole-token alias it names', () => {
  function hairlineBaseIndex(): Map<string, CorpusEntry> {
    return new Map([
      [
        'dimension.hairline',
        {
          path: 'dimension.hairline',
          value: { value: 1, unit: 'px' },
          type: 'dimension',
          description: undefined,
          cssProperty: '--test-hairline',
          cssRecipe: undefined,
        },
      ],
    ]);
  }

  test('resolveAlias strips a trailing $value segment before the baseIndex lookup', () => {
    // `resolve.test.ts`'s "resolves a property-level JSON Pointer reference into a composite
    // token value" case accepts exactly this shape (`#/dimension/hairline/$value`) as a
    // whole-token alias -- resolve.ts's own resolver special-cases a trailing `$value` segment
    // the same way `{dimension.hairline}` would resolve. Pre-fix, `tokenPathFromReference` dot-joins
    // every segment with no such special case, so the lookup below misses the token entirely.
    expect(resolveAlias('#/dimension/hairline/$value', hairlineBaseIndex())).toBe(
      'var(--test-hairline)',
    );
  });

  test('a curly alias ending in .$value is a literal dotted path, not the pointer special case', () => {
    // `{a.b.$value}` is not resolve.ts's pointer-form special case -- it is a literal dotted
    // path through the corpus (an actual property named "$value" would be pathological, but the
    // curly syntax has no notion of "the whole token" the way a trailing pointer segment does).
    // Stripping it here would make the generator accept a shape the validator does not, the same
    // class of generator/validator disagreement this fix exists to close. The path is looked up
    // as literally "dimension.hairline.$value", which this baseIndex does not contain, so this
    // still throws -- proving the fix is gated on `#/` pointer syntax, not a blanket strip.
    expect(() => resolveAlias('{dimension.hairline.$value}', hairlineBaseIndex())).toThrow(
      /does not resolve to a base token/,
    );
  });

  test('a terminal composite-member segment (not $value) is left to fail the lookup, not silently reinterpreted', () => {
    // `#/border/thin/width` names a PIECE of the "border.thin" token's value, not the whole
    // token -- resolveAlias only knows how to emit `var(--property)` for a whole-token identity,
    // so this deliberately still throws rather than being treated as an alias to "border.thin".
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'border.thin',
        {
          path: 'border.thin',
          value: { color: '#000', width: { value: 1, unit: 'px' }, style: 'solid' },
          type: 'border',
          description: undefined,
          cssProperty: '--test-border-thin',
          cssRecipe: undefined,
        },
      ],
    ]);
    expect(() => resolveAlias('#/border/thin/width', baseIndex)).toThrow(
      /does not resolve to a base token/,
    );
  });
});

describe('a $ref whole-token alias to a $root token normalizes like resolve.ts does', () => {
  function rootBaseIndex(): Map<string, CorpusEntry> {
    return new Map([
      [
        'space',
        {
          path: 'space',
          value: { value: 4, unit: 'px' },
          type: 'dimension',
          description: undefined,
          cssProperty: '--test-space',
          cssRecipe: undefined,
        },
      ],
      [
        '',
        {
          path: '',
          value: { value: 0, unit: 'px' },
          type: 'dimension',
          description: undefined,
          cssProperty: '--test-root',
          cssRecipe: undefined,
        },
      ],
    ]);
  }

  test('#/group/$root resolves to the group\'s own baseIndex entry, not "group.$root"', () => {
    // `collectEntries` indexes a group's `$root` token at the group's OWN path
    // (`into.set(prefix, ...)`), not `prefix.$root` -- `tokenPathFromReference`'s
    // plain dot-join would otherwise look up the wrong key and throw.
    expect(resolveAlias('#/space/$root', rootBaseIndex())).toBe('var(--test-space)');
  });

  test('#/group/$root/$value resolves the same way, stripping both segments', () => {
    expect(resolveAlias('#/space/$root/$value', rootBaseIndex())).toBe('var(--test-space)');
  });

  test('a bare #/$root resolves to the document root token', () => {
    expect(resolveAlias('#/$root', rootBaseIndex())).toBe('var(--test-root)');
  });

  test('#/$root/$value resolves the same way', () => {
    expect(resolveAlias('#/$root/$value', rootBaseIndex())).toBe('var(--test-root)');
  });
});

describe('a property-level $ref falls through to typed serialization instead of throwing', () => {
  test('a $ref targeting a scalar member of another token serializes that resolved value, not var(...)', () => {
    // `$ref` is a generic JSON Pointer with no DTCG requirement that its
    // target be a whole token, unlike an ordinary bare-alias $value (which
    // this generator has always required to name a whole token). A property-
    // level $ref resolves fine at `tokens:validate` time but has no matching
    // baseIndex entry, so it must fall through to `serializeTypedValue`
    // (via `resolveReferences`) instead of throwing the way an ordinary
    // $value alias to a non-whole-token path still does.
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'dimension.hairline',
        {
          path: 'dimension.hairline',
          value: { value: 1, unit: 'px' },
          type: 'dimension',
          description: undefined,
          cssProperty: '--test-hairline',
          cssRecipe: undefined,
        },
      ],
      [
        'space.tight',
        {
          path: 'space.tight',
          value: '#/dimension/hairline/$value/value',
          type: 'number',
          description: undefined,
          cssProperty: '--test-tight',
          cssRecipe: undefined,
          isRefAlias: true,
        },
      ],
    ]);
    const resolveReferences: ValueResolver = (raw) =>
      raw === '#/dimension/hairline/$value/value' ? 1 : raw;
    const entry = baseIndex.get('space.tight')!;
    expect(serializeEntryValue(entry, baseIndex, resolveReferences)).toBe('1');
  });

  test('an ordinary $value alias to a non-whole-token path still throws (unchanged, not loosened by the $ref fix)', () => {
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'border.thin',
        {
          path: 'border.thin',
          value: { color: '#000', width: { value: 1, unit: 'px' }, style: 'solid' },
          type: 'border',
          description: undefined,
          cssProperty: '--test-border-thin',
          cssRecipe: undefined,
        },
      ],
      [
        'border.derived',
        {
          path: 'border.derived',
          value: '#/border/thin/width',
          type: 'dimension',
          description: undefined,
          cssProperty: '--test-derived',
          cssRecipe: undefined,
          isRefAlias: false,
        },
      ],
    ]);
    const entry = baseIndex.get('border.derived')!;
    expect(() => serializeEntryValue(entry, baseIndex)).toThrow(/does not resolve to a base token/);
  });
});

describe('CIN-29 review round 5', () => {
  function entry(
    path: string,
    cssProperty: string | undefined,
    value: unknown = { value: 1, unit: 'rem' },
  ): [string, CorpusEntry] {
    return [
      path,
      {
        path,
        value,
        type: 'dimension',
        description: undefined,
        cssProperty,
        cssRecipe: undefined,
      },
    ];
  }

  test('G1: one cssProperty claimed with conflicting values is rejected, not silently cascaded', () => {
    // tokens:validate cannot catch this -- the mapping lives in vendor extension data, which
    // the DTCG schema treats as free-form. Undetected, CSS keeps whichever declaration lands
    // last while the resolved snapshots go on exposing both token paths.
    const conflicting = new Map<string, CorpusEntry>([
      entry('space.one', '--test-space', { value: 1, unit: 'rem' }),
      entry('space.uno', '--test-space', { value: 2, unit: 'rem' }),
    ]);
    expect(() => assertUniqueCssProperties(conflicting)).toThrow(
      /--test-space is claimed with conflicting values by space\.one, space\.uno/,
    );
  });

  test('G1: one cssProperty shared with an IDENTICAL value is allowed', () => {
    // $extends inheritance legitimately produces two paths for one property -- the extending
    // group inherits members verbatim, extension metadata included -- and they emit the same
    // declaration twice, which is redundant but harmless. Flagging it would break E3.
    const inherited = new Map<string, CorpusEntry>([
      entry('foundation.swatch', '--test-swatch', { value: 1, unit: 'rem' }),
      entry('themed.swatch', '--test-swatch', { value: 1, unit: 'rem' }),
    ]);
    expect(() => assertUniqueCssProperties(inherited)).not.toThrow();
  });

  test('G1: distinct mappings pass, and tokens without a cssProperty are ignored', () => {
    const distinct = new Map<string, CorpusEntry>([
      entry('space.one', '--test-space-one'),
      entry('space.two', '--test-space-two'),
    ]);
    expect(() => assertUniqueCssProperties(distinct)).not.toThrow();

    const untracked = new Map<string, CorpusEntry>([entry('a', undefined), entry('b', undefined)]);
    expect(() => assertUniqueCssProperties(untracked)).not.toThrow();
  });
});

describe('CIN-30 review round 11: group $deprecated inherits like $type', () => {
  function entriesFor(group: Parameters<typeof collectEntries>[0]) {
    const into = new Map<string, CorpusEntry>();
    collectEntries(group, '', undefined, into);
    return into;
  }

  // DTCG makes `$deprecated` inheritable the way `$type` is, and the flattened
  // corpus keeps no group records -- so without carrying it down, a deprecated
  // group's children were all reported `deprecated: undefined` and registry
  // consumers would surface them as current.
  test('a child with no $deprecated inherits its group state', () => {
    const entries = entriesFor({
      legacy: {
        $type: 'dimension',
        $deprecated: 'Use space.* instead.',
        gutter: { $value: { value: 1, unit: 'rem' } },
        inner: {
          nested: { $value: { value: 2, unit: 'rem' } },
        },
      },
    });

    expect(entries.get('legacy.gutter')?.deprecated).toBe('Use space.* instead.');
    // Inheritance reaches through an intermediate group, not just direct children.
    expect(entries.get('legacy.inner.nested')?.deprecated).toBe('Use space.* instead.');
  });

  test("a child's own $deprecated wins over the group's", () => {
    const entries = entriesFor({
      legacy: {
        $type: 'dimension',
        $deprecated: 'Group reason.',
        gutter: { $value: { value: 1, unit: 'rem' }, $deprecated: 'Token reason.' },
      },
    });

    expect(entries.get('legacy.gutter')?.deprecated).toBe('Token reason.');
  });

  // `false` on a nested group is a real value, not an absence: it un-deprecates
  // that subtree. Merging with `||` instead of `??` would silently ignore it.
  test('a nested group can un-deprecate itself with $deprecated: false', () => {
    const entries = entriesFor({
      legacy: {
        $type: 'dimension',
        $deprecated: true,
        kept: {
          $deprecated: false,
          gutter: { $value: { value: 1, unit: 'rem' } },
        },
        dropped: { $value: { value: 2, unit: 'rem' } },
      },
    });

    expect(entries.get('legacy.kept.gutter')?.deprecated).toBe(false);
    expect(entries.get('legacy.dropped')?.deprecated).toBe(true);
  });

  test('a $root token inherits its own group state', () => {
    const entries = entriesFor({
      legacy: {
        $type: 'dimension',
        $deprecated: 'Gone soon.',
        $root: { $value: { value: 1, unit: 'rem' } },
      },
    });

    expect(entries.get('legacy')?.deprecated).toBe('Gone soon.');
  });

  test('an undeprecated group still yields undefined, not false', () => {
    const entries = entriesFor({
      space: { $type: 'dimension', gutter: { $value: { value: 1, unit: 'rem' } } },
    });

    expect(entries.get('space.gutter')?.deprecated).toBeUndefined();
  });
});

describe('CIN-471: $deprecated carries through $extends expansion', () => {
  function entriesFor(documents: Parameters<typeof mergeAndExpandExtends>[0]) {
    const into = new Map<string, CorpusEntry>();
    collectEntries(mergeAndExpandExtends(documents), '', undefined, into);
    return into;
  }

  // `mergeAndExpandExtends` (via `resolveExtends`) already copies an extended
  // group's members and `$type` into the group that extends it; before this
  // fix it dropped `$deprecated`, so a group extending a deprecated group
  // came out looking current -- registry consumers had no way to know.
  test('a group extending a $deprecated group yields deprecated descendants', () => {
    const entries = entriesFor([
      {
        legacy: { $type: 'dimension', $deprecated: 'Use space.* instead.', gutter: { $value: 1 } },
        derived: { $extends: '{legacy}' },
      },
    ]);

    expect(entries.get('derived.gutter')?.deprecated).toBe('Use space.* instead.');
  });

  test("a descendant's own $deprecated wins over the extended group's", () => {
    const entries = entriesFor([
      {
        legacy: {
          $type: 'dimension',
          $deprecated: 'Group reason.',
          gutter: { $value: 1 },
        },
        derived: {
          $extends: '{legacy}',
          gutter: { $value: 2, $deprecated: 'Token reason.' },
        },
      },
    ]);

    expect(entries.get('derived.gutter')?.deprecated).toBe('Token reason.');
  });

  // `$deprecated: false` is a real value, not an absence -- it un-deprecates a
  // subtree even beneath a deprecated `$extends` target, the same "??" rule
  // `collectEntries` already applies to ordinary group nesting.
  test('a descendant under a $deprecated: false group inside a deprecated extend target is not deprecated', () => {
    const entries = entriesFor([
      {
        legacy: {
          $type: 'dimension',
          $deprecated: true,
          kept: { $deprecated: false, gutter: { $value: 1 } },
        },
        derived: { $extends: '{legacy}' },
      },
    ]);

    expect(entries.get('derived.kept.gutter')?.deprecated).toBe(false);
  });

  // Guards `group.$deprecated === undefined` rather than unconditionally
  // taking the extended group's value: an extending group that declares its
  // OWN $deprecated (including the real value `false`) must keep it, not
  // have it overwritten by what it extends.
  test('an extending group keeps its own $deprecated: false over a deprecated extend target', () => {
    const entries = entriesFor([
      {
        legacy: { $type: 'dimension', $deprecated: true, gutter: { $value: 1 } },
        derived: { $extends: '{legacy}', $deprecated: false, other: { $value: 2 } },
      },
    ]);

    expect(entries.get('derived.gutter')?.deprecated).toBe(false);
    expect(entries.get('derived.other')?.deprecated).toBe(false);
  });

  // Regression: `resolveExtends` read the extended group's OWN `$deprecated`
  // property directly, which is `undefined` for a group that only inherits
  // deprecation from an ANCESTOR (via ordinary nesting, not $extends) --
  // ancestor-to-descendant propagation for ordinary nesting happens later, in
  // `collectEntries` at generation time, well after `$extends` has already
  // run. A group extending such a target lost the deprecation entirely, even
  // though every token under the target is itself effectively deprecated by
  // the time generation walks it.
  test('a group extending a target that only inherits $deprecated from an ancestor is deprecated too', () => {
    const entries = entriesFor([
      {
        outer: {
          $type: 'dimension',
          $deprecated: 'Use space.* instead.',
          base: { gutter: { $value: 1 } },
        },
        derived: { $extends: '{outer.base}' },
      },
    ]);

    expect(entries.get('outer.base.gutter')?.deprecated).toBe('Use space.* instead.');
    expect(entries.get('derived.gutter')?.deprecated).toBe('Use space.* instead.');
  });

  test('CIN-475 (known gap, not fixed here): a nested $extends target only in the lookup scope loses its deprecation when shadowed', () => {
    // `mergeAndExpandExtends(ownDocuments, lookupDocuments)` is how theme/motion
    // override contexts extend a foundation group -- here "outer.base" exists only
    // in the lookup scope and inherits $deprecated from the lookup scope's own
    // "outer". The override document ALSO declares its own non-deprecated "outer"
    // (a sibling override, not itself extending anything), which collectGroups loads
    // AFTER the lookup scope and so shadows it in the merged groups map.
    // effectiveGroupDeprecated then walks the OVERRIDING "outer", not the lookup
    // scope's, and misses the deprecation. This test PINS today's known-limited
    // behavior (undefined) rather than the eventually-correct one, so CIN-475
    // landing is a deliberate, visible test change.
    const into = new Map<string, CorpusEntry>();
    collectEntries(
      mergeAndExpandExtends(
        [{ outer: { other: { $value: 1 } }, derived: { $extends: '{outer.base}' } }],
        [
          {
            outer: {
              $type: 'dimension',
              $deprecated: 'Use space.* instead.',
              base: { gutter: { $value: 1 } },
            },
          },
        ],
      ),
      '',
      undefined,
      into,
    );

    expect(into.get('derived.gutter')?.deprecated).toBeUndefined();
  });

  test('CIN-476 (known gap, not fixed here): declaration order determines whether an ancestor extends chain is resolved before it is cached', () => {
    // "derived" (declared first) extends "outer.child" -- a plain nested
    // group with no $extends of its own. "outer" (declared second) extends
    // "legacy", which is where the real deprecation reason lives. Because
    // resolveExtends processes groups in `groups.keys()` order (collectGroups's
    // traversal order, which follows document declaration order), "derived"
    // is resolved BEFORE "outer" -- effectiveGroupDeprecated walks up from
    // "outer.child" through the not-yet-expanded "outer" (still undefined)
    // to the document root's declared $deprecated: false, and caches that.
    // Once "outer" is later expanded and gains "Legacy reason.", "derived"'s
    // cached false is never revisited. This test PINS today's known-limited
    // behavior (false, not "Legacy reason.") so CIN-476 landing is a
    // deliberate, visible test change.
    const entries = entriesFor([
      {
        $deprecated: false,
        derived: { $extends: '{outer.child}' },
        outer: { $extends: '{legacy}', child: { grandchild: { $value: 1 } } },
        legacy: { $deprecated: 'Legacy reason.', marker: { $value: true } },
      },
    ]);

    expect(entries.get('derived.grandchild')?.deprecated).toBe(false);
  });
});

describe('CIN-463 review: collectEntries recognizes $ref tokens, not only $value', () => {
  // Regression: `generate.ts` kept its OWN `isToken` copy, independent of
  // resolve.ts's (which CIN-463 already fixed) -- checking `$value` alone
  // classified a `$ref`-only node as an (empty) group, so it silently
  // vanished from `tokens-base.css` and the generated registry (both walk
  // the raw corpus via `collectEntries`) even though it validated and
  // resolved correctly.
  test('a $ref token is not dropped from the collected entries', () => {
    const into = new Map<string, CorpusEntry>();
    collectEntries(
      {
        base: {
          $value: 1,
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--cinder-base' } },
        },
        copy: {
          $ref: '#/base',
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--cinder-copy' } },
        },
      },
      '',
      undefined,
      into,
    );

    expect(into.has('copy')).toBe(true);
    expect(into.get('copy')?.value).toBe('#/base');
  });

  test('a $ref token in a base index resolves to the referenced cssProperty via var()', () => {
    const baseIndex = new Map<string, CorpusEntry>();
    collectEntries(
      {
        base: {
          $type: 'number',
          $value: 1,
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--cinder-base' } },
        },
        copy: {
          $ref: '#/base',
          $extensions: { 'com.lostgradient.cinder': { cssProperty: '--cinder-copy' } },
        },
      },
      '',
      undefined,
      baseIndex,
    );

    const copyEntry = baseIndex.get('copy');
    expect(copyEntry).toBeDefined();
    expect(serializeEntryValue(copyEntry!, baseIndex)).toBe('var(--cinder-base)');
  });
});

describe('CIN-30 review round 14: the uniqueness key includes $type', () => {
  function entry(path: string, type: 'fontFamily' | 'fontWeight'): CorpusEntry {
    return {
      path,
      value: 'normal',
      type,
      description: undefined,
      cssProperty: '--cinder-test-normal',
      cssRecipe: undefined,
      public: true,
      category: 'typography',
      component: undefined,
      deprecated: undefined,
    };
  }

  // Serialization is type-directed: `fontFamily: "normal"` emits `normal` while
  // `fontWeight: "normal"` emits `400`. Hashing only the raw $value called this
  // pair identical, so the first-claimant docs index documented one form while
  // the CSS and the drift test's last-write map used the other -- regeneration
  // then produced documentation the required drift test rejected.
  test('two entries sharing a value but differing in type are a conflict', () => {
    const entries = new Map<string, CorpusEntry>([
      ['type.family', entry('type.family', 'fontFamily')],
      ['type.weight', entry('type.weight', 'fontWeight')],
    ]);

    expect(() => assertUniqueCssProperties(entries)).toThrow(
      /--cinder-test-normal is claimed with conflicting values by type\.family, type\.weight/,
    );
  });

  test('two entries agreeing on value AND type are still permitted', () => {
    const entries = new Map<string, CorpusEntry>([
      ['type.family', entry('type.family', 'fontFamily')],
      ['type.alias', entry('type.alias', 'fontFamily')],
    ]);

    expect(() => assertUniqueCssProperties(entries)).not.toThrow();
  });
});
