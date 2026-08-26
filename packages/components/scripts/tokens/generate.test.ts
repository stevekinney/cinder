import { describe, expect, test } from 'bun:test';

import {
  buildGeneratedOutputs,
  buildResolvedContexts,
  buildTokensBaseCss,
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
        .map((name) => `${resolvedDirectory}/${name}.json`)
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

    const lightPath = `${resolvedDirectory}/light.json`;
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
