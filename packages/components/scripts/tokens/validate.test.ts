import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TokenValidationError, type TokenDocument } from './types.ts';
import {
  assertValidResolverDocument,
  assertValidTokenDocument,
  validateResolvedToken,
  validateResolverDocument,
  validateTokenDocument,
} from './validate.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = join(scriptDirectory, 'fixtures');

function readFixture(subdirectory: 'valid' | 'invalid', name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDirectory, subdirectory, name), 'utf8'));
}

function fixtureNames(subdirectory: 'valid' | 'invalid'): string[] {
  return readdirSync(join(fixturesDirectory, subdirectory))
    .filter((name) => name.endsWith('.tokens.json'))
    .toSorted();
}

const validFixtureNames = fixtureNames('valid');
const invalidFixtureNames = fixtureNames('invalid');
const DTCG_TOKEN_TYPES = [
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
];

const cases: Array<{ type: NonNullable<TokenDocument['$type']>; value: unknown }> = [
  { type: 'color', value: { colorSpace: 'oklch', components: [0.5, 0.1, 255] } },
  { type: 'dimension', value: { value: 1, unit: 'rem' } },
  { type: 'fontFamily', value: ['Inter', 'sans-serif'] },
  { type: 'fontWeight', value: 600 },
  { type: 'duration', value: { value: 150, unit: 'ms' } },
  { type: 'cubicBezier', value: [0.2, 0, 0, 1] },
  { type: 'number', value: 1 },
  { type: 'strokeStyle', value: 'solid' },
  { type: 'border', value: { color: '{color}', width: '{dimension}', style: 'solid' } },
  {
    type: 'transition',
    value: { duration: '{duration}', delay: '{duration}', timingFunction: '{easing}' },
  },
  {
    type: 'shadow',
    value: {
      color: '{color}',
      offsetX: '{dimension}',
      offsetY: '{dimension}',
      blur: '{dimension}',
      spread: '{dimension}',
    },
  },
  {
    type: 'gradient',
    value: [
      { color: '{color}', position: 0 },
      { color: '{color}', position: 1 },
    ],
  },
  {
    type: 'typography',
    value: {
      fontFamily: '{family}',
      fontSize: '{dimension}',
      fontWeight: '{weight}',
      letterSpacing: '{dimension}',
      lineHeight: 1.5,
    },
  },
  {
    type: 'typography',
    value: {
      fontFamily: '{family}',
      fontSize: '{dimension}',
      fontWeight: '{weight}',
      letterSpacing: '{dimension}',
      lineHeight: { value: 24, unit: 'px' },
    },
  },
];

describe('DTCG semantic validation', () => {
  test('fixtures/valid covers every DTCG type Cinder claims to support', () => {
    expect(validFixtureNames).toEqual(
      DTCG_TOKEN_TYPES.map((type) => `${type}.tokens.json`).toSorted(),
    );
  });

  test.each(validFixtureNames)(
    'accepts fixtures/valid/%s through the full load-time gate',
    (name) => {
      expect(() =>
        assertValidTokenDocument(readFixture('valid', name), `fixtures/valid/${name}`),
      ).not.toThrow();
    },
  );

  test.each(invalidFixtureNames)(
    'rejects fixtures/invalid/%s with a named path and reason',
    (name) => {
      let caught: unknown;
      try {
        assertValidTokenDocument(readFixture('invalid', name), `fixtures/invalid/${name}`);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(TokenValidationError);
      const issues = (caught as TokenValidationError).issues;
      expect(issues.length).toBeGreaterThan(0);
      for (const issue of issues) {
        expect(issue.path.length).toBeGreaterThan(0);
        expect(issue.reason.length).toBeGreaterThan(0);
      }
    },
  );

  test.each(cases)('accepts the $type value shape', ({ type, value }) => {
    expect(() => validateTokenDocument({ $type: type, sample: { $value: value } })).not.toThrow();
  });

  test('rejects cubicBezier values with out-of-range x coordinates', () => {
    expect(() =>
      validateTokenDocument({ $type: 'cubicBezier', sample: { $value: [2, 0, -1, 1] } }),
    ).toThrow('x coordinates');
  });

  test('preserves unknown vendor extension data', () => {
    const document: TokenDocument = {
      color: {
        $type: 'color',
        $value: { colorSpace: 'oklch', components: [0.5, 0.1, 255] },
        $extensions: { 'com.example.vendor': { untouched: ['exact', 1] } },
      },
    };
    validateTokenDocument(document);
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  test('reports source paths and invalid names', () => {
    expect(() =>
      validateTokenDocument({ bad: { 'also.bad': { $type: 'number', $value: 1 } } }),
    ).toThrow(TokenValidationError);
    try {
      validateTokenDocument({ bad: { 'also.bad': { $type: 'number', $value: 1 } } });
    } catch (error) {
      expect(String(error)).toContain('$.bad.also.bad');
    }
  });

  test('rejects tokens that also contain groups', () => {
    expect(() =>
      validateTokenDocument({ $type: 'number', value: { $value: 1, child: {} } }),
    ).toThrow('cannot contain child groups');
  });

  test('requires a direct or inherited type', () => {
    expect(() => validateTokenDocument({ value: { $value: 1 } })).toThrow('no $type');
  });

  test('attributes $root token issues to the $root location, not the enclosing group', () => {
    // A group holding a $root usually has siblings, so reporting at the group
    // path alone cannot tell the author which one is wrong.
    expect(() =>
      validateTokenDocument({
        accent: {
          $type: 'number',
          $root: { $value: 1, $valu: 2 },
          hover: { $value: 3 },
        },
      }),
    ).toThrow('accent.$root: unknown reserved property $valu');
  });

  test('accepts a $ref token alias in place of $value (CIN-463)', () => {
    // No $type declared or inherited anywhere in this document -- a $ref
    // token borrows its type from the reference target at resolution time
    // (see resolve.ts's resolveRefToken), so validate.ts must not require
    // one here.
    expect(() =>
      validateTokenDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $ref: '#/base' },
      }),
    ).not.toThrow();
  });

  test('accepts a $ref token that declares its own $type', () => {
    expect(() =>
      validateTokenDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $type: 'number', $ref: '#/base' },
      }),
    ).not.toThrow();
  });

  test('rejects a $ref token declaring an unknown $type', () => {
    expect(() =>
      validateTokenDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $type: 'nonsense', $ref: '#/base' },
      }),
    ).toThrow('unknown $type');
  });

  test('rejects a token declaring both $value and $ref', () => {
    expect(() =>
      validateTokenDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $type: 'number', $value: 2, $ref: '#/base' },
      }),
    ).toThrow('copy: a token cannot declare both $value and $ref');
  });

  test('rejects a $ref that is not a JSON Pointer', () => {
    // The vendored format schema types the token-level $ref as
    // jsonPointerReference only -- curly-brace syntax is not a legal $ref,
    // even though it IS legal inside a $value.
    expect(() => validateTokenDocument({ copy: { $ref: '{base}' } })).toThrow(
      '$ref must be a JSON Pointer reference',
    );
  });

  test('rejects a $ref token with a nested child group', () => {
    expect(() =>
      validateTokenDocument({ copy: { $ref: '#/base', nested: { $value: 1 } } }),
    ).toThrow('cannot contain child groups');
  });

  test('accepts root tokens and rejects unknown reserved metadata', () => {
    expect(() =>
      validateTokenDocument({ group: { $type: 'number', $root: { $value: 1 } } }),
    ).not.toThrow();
    expect(() => validateTokenDocument({ value: { $type: 'number', $valu: 1 } })).toThrow(
      'unknown reserved property $valu',
    );
    expect(() => validateTokenDocument({ group: { $extends: 42 } })).toThrow(
      '$extends must be a token reference',
    );
    expect(() =>
      validateTokenDocument({
        group: { $root: { $type: 'number', $value: 1, child: { $type: 'number', $value: 2 } } },
      }),
    ).toThrow('$root token cannot contain child groups');
  });

  test('defers nested token types inherited through a group extension', () => {
    expect(() =>
      validateTokenDocument({
        base: { $type: 'number', token: { $value: 1 } },
        derived: { $extends: '{base}', nested: { token: { $value: 2 } } },
      }),
    ).not.toThrow();
  });

  test('validates composite member shapes', () => {
    expect(() =>
      validateTokenDocument({
        $type: 'border',
        sample: {
          $value: {
            color: { colorSpace: 'oklch', components: ['invalid', 0.1, 255] },
            width: { value: 1, unit: 'px' },
            style: 'solid',
          },
        },
      }),
    ).toThrow('three numeric or none components');
    expect(() =>
      validateTokenDocument({
        $type: 'transition',
        sample: {
          $value: {
            duration: { value: 1, unit: 'ms' },
            delay: { value: 0, unit: 'ms' },
            timingFunction: [0, 0, 'invalid', 1],
          },
        },
      }),
    ).toThrow('cubicBezier must be four numbers');
    expect(() =>
      validateTokenDocument({
        $type: 'strokeStyle',
        sample: { $value: { dashArray: ['invalid'], lineCap: 'round' } },
      }),
    ).toThrow('dimension must have a numeric value');
    expect(() =>
      validateTokenDocument({
        $type: 'shadow',
        sample: {
          $value: {
            color: '{color}',
            offsetX: '{dimension}',
            offsetY: '{dimension}',
            blur: '{dimension}',
            spread: '{dimension}',
            inset: 'invalid',
          },
        },
      }),
    ).toThrow('inset must be boolean');
    expect(() =>
      validateTokenDocument({
        $type: 'shadow',
        sample: {
          $value: [
            {
              color: '{color}',
              offsetX: '{dimension}',
              offsetY: '{dimension}',
              blur: '{dimension}',
              spread: '{dimension}',
              inset: 'invalid',
            },
          ],
        },
      }),
    ).toThrow('inset must be boolean');
  });

  test('rejects unsupported color and composite value shapes', () => {
    expect(() =>
      validateTokenDocument({
        $type: 'color',
        sample: { $value: { colorSpace: 'banana', components: [0, 0, 0], hex: 'red' } },
      }),
    ).toThrow('color must have');
    expect(() =>
      validateTokenDocument({
        $type: 'strokeStyle',
        sample: { $value: { dashArray: [], lineCap: 'round' } },
      }),
    ).toThrow('strokeStyle must');
    expect(() => validateTokenDocument({ $type: 'shadow', sample: { $value: [] } })).toThrow(
      'shadow must',
    );
    expect(() =>
      validateTokenDocument({
        $type: 'transition',
        sample: {
          $value: {
            duration: '{duration}',
            delay: '{duration}',
            timingFunction: '{easing}',
            timingFuction: '{easing}',
          },
        },
      }),
    ).toThrow('unknown composite member timingFuction');
    expect(() =>
      validateTokenDocument({
        $type: 'color',
        sample: { $value: { colorSpace: 'oklch', components: [0, 0, 0], alpah: 0.5 } },
      }),
    ).toThrow('unknown color member alpah');
    expect(() =>
      validateTokenDocument({
        $type: 'typography',
        sample: {
          $value: {
            fontFamily: '{family}',
            fontSize: '{dimension}',
            fontWeight: '{weight}',
            letterSpacing: '{dimension}',
            lineHeight: -1,
          },
        },
      }),
    ).toThrow('lineHeight must be non-negative');
    expect(() =>
      validateTokenDocument({
        $type: 'color',
        sample: { $value: { colorSpace: 'oklch', components: [0, 0, 0], hex: '#11223380' } },
      }),
    ).not.toThrow();
    expect(() =>
      validateTokenDocument({
        $type: 'color',
        sample: { $value: { colorSpace: 'oklch', components: [0, 0, 0], hex: '#12345' } },
      }),
    ).toThrow('valid optional alpha or hex');
    expect(() =>
      validateTokenDocument({
        $type: 'color',
        sample: { $value: { colorSpace: 'oklch', components: [0, 0, 0], alpha: '{opacity}' } },
      }),
    ).not.toThrow();
    expect(() =>
      validateTokenDocument({
        $type: 'dimension',
        sample: { $value: { value: 1, unit: 'px', units: 'rem' } },
      }),
    ).toThrow('unknown dimension member units');
    expect(() =>
      validateTokenDocument({
        $type: 'duration',
        sample: { $value: { value: 1, unit: 'ms', units: 's' } },
      }),
    ).toThrow('unknown duration member units');
    expect(() =>
      validateTokenDocument({
        $type: 'shadow',
        sample: {
          $value: {
            color: '{color}',
            offsetX: '{dimension}',
            offsetY: '{dimension}',
            blur: '{dimension}',
            spread: '{dimension}',
            inset: '{inset}',
          },
        },
      }),
    ).not.toThrow();
  });

  test('rejects negative durations', () => {
    expect(() =>
      validateTokenDocument({ duration: { $type: 'duration', $value: { value: -1, unit: 'ms' } } }),
    ).toThrow('non-negative');
  });

  test('rejects invalid font, stroke, and gradient values', () => {
    expect(() => validateTokenDocument({ $type: 'fontFamily', sample: { $value: [] } })).toThrow();
    expect(() => validateTokenDocument({ $type: 'fontWeight', sample: { $value: 0 } })).toThrow();
    expect(() =>
      validateTokenDocument({ $type: 'fontWeight', sample: { $value: 'semi-bold' } }),
    ).not.toThrow();
    expect(() =>
      validateTokenDocument({ $type: 'fontWeight', sample: { $value: 'extra-black' } }),
    ).not.toThrow();
    expect(() =>
      validateTokenDocument({ $type: 'strokeStyle', sample: { $value: 'banana' } }),
    ).toThrow();
    expect(() => validateTokenDocument({ $type: 'gradient', sample: { $value: [] } })).toThrow();
    expect(() =>
      validateTokenDocument({
        $type: 'gradient',
        sample: {
          $value: [
            { color: '{x}', position: 2 },
            { color: '{x}', position: 1 },
          ],
        },
      }),
    ).toThrow('position must be within');
    expect(() =>
      validateTokenDocument({
        $type: 'gradient',
        sample: {
          $value: [
            { color: '{x}', position: 1 },
            { color: '{x}', position: 0 },
          ],
        },
      }),
    ).toThrow('positions must be nondecreasing');
  });

  test('rejects negative shadow blur while permitting negative offsets', () => {
    const shadow = {
      color: '{color}',
      offsetX: { value: -1, unit: 'px' },
      offsetY: '{dimension}',
      blur: { value: -1, unit: 'px' },
      spread: '{dimension}',
    };
    expect(() => validateTokenDocument({ $type: 'shadow', sample: { $value: shadow } })).toThrow(
      'blur must be non-negative',
    );
  });

  test('revalidates a resolved alias against its declared type', () => {
    expect(() =>
      validateResolvedToken(
        { $type: 'number', $value: { colorSpace: 'oklch', components: [0.5, 0.1, 255] } },
        'number-alias',
      ),
    ).toThrow('number must be numeric');
  });

  test('validates resolver modifier and ordering contracts', () => {
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
            default: 'light',
          },
        },
        resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
      }),
    ).not.toThrow();
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {},
        modifiers: {},
        resolutionOrder: [{ $ref: '#/modifiers/theme' }],
      }),
    ).toThrow('existing set or modifier');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [] } },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/base' }],
      }),
    ).toThrow('non-empty array of $ref sources');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
        modifiers: {
          theme: { contexts: { light: [], dark: [{ $ref: 'themes/dark.tokens.json' }] } },
        },
        resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
      }),
    ).toThrow('non-empty array of $ref sources');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
          },
        },
        resolutionOrder: [{ $ref: '#/sets/base' }],
      }),
    ).toThrow('must list every set and modifier exactly once');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
            default: 'sepia',
          },
        },
        resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
      }),
    ).toThrow('default must be one of its context names');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
          },
        },
        resolutionOrder: [
          { $ref: '#/sets/base' },
          { $ref: '#/modifiers/theme' },
          { $ref: '#/modifiers/theme' },
        ],
      }),
    ).toThrow('resolutionOrder entries must be unique');
  });

  test('CIN-464: a set reached only via an internal reference need not appear in resolutionOrder', () => {
    // `extended`'s sources reference `#/sets/base`; `base` contributes its
    // documents through that reference (see validate-corpus.ts's
    // expandSetSources) rather than as its own resolutionOrder entry, so
    // requiring it there too would be redundant -- and, listed at its own
    // position, would re-inject its documents ahead of whatever `extended`
    // is meant to layer over them.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          extended: {
            sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/extra.tokens.json' }],
          },
        },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/extended' }],
      }),
    ).not.toThrow();

    // A set that no one references internally is still required, even when
    // other sets in the same document are internally referenced.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          extended: { sources: [{ $ref: '#/sets/base' }] },
          standalone: { sources: [{ $ref: 'sets/standalone.tokens.json' }] },
        },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/extended' }],
      }),
    ).toThrow('must list every set and modifier exactly once');
  });

  test('rejects a set referenced only by a modifier context, with no path into the base', () => {
    // A set reached through another SET is exempt from resolutionOrder
    // (verified above) because it still contributes to the BASE via the
    // referencing set's own expansion. A set reached ONLY through a modifier
    // context is different: `buildTokensBaseCss`/`buildBaseDocuments` build
    // the base index exclusively from `resolutionOrder`'s set entries, so a
    // set with no base path has nothing for the override to override --
    // generation would fail with "no matching base token" for a shape
    // validation otherwise accepted as fine. This must be rejected here,
    // clearly, rather than surfacing later as a confusing generation error.
    expect(() =>
      validateResolverDocument({
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
        resolutionOrder: [{ $ref: '#/modifiers/theme' }],
      }),
    ).toThrow(/references set "base", which has no path into the base/);
  });

  test('names the FIRST context that references an unreachable set, not the last-processed one', () => {
    // `noteSetReferencedByModifierContext` used a plain `Map.set`, which
    // overwrites the recorded reference site when multiple contexts
    // reference the same unreachable set -- losing evidence of every context
    // but whichever was processed last (object key order here: "light" then
    // "dark").
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: { base: { sources: [{ $ref: 'sets/base.tokens.json' }] } },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: '#/sets/base' }, { $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: '#/sets/base' }, { $ref: 'themes/dark.tokens.json' }],
            },
          },
        },
        resolutionOrder: [{ $ref: '#/modifiers/theme' }],
      }),
    ).toThrow(/\$\.modifiers\.theme\.contexts\.light/);
  });

  test('accepts a set referenced by a modifier context when it also has a path into the base', () => {
    // Same shape as the rejection above, but `base` is ALSO listed directly
    // in resolutionOrder, giving it a real base declaration for the modifier
    // context to override -- this is the legitimate version of the pattern.
    expect(() =>
      validateResolverDocument({
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
      }),
    ).not.toThrow();

    // Also legitimate: `base` is reached from the base through another SET
    // (`extended`), not listed directly, but a modifier context also
    // references it internally -- `extended` gives it a base path.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          extended: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/extra.tokens.json' }] },
        },
        modifiers: {
          theme: { contexts: { light: [{ $ref: '#/sets/base' }] } },
        },
        resolutionOrder: [{ $ref: '#/sets/extended' }, { $ref: '#/modifiers/theme' }],
      }),
    ).not.toThrow();
  });

  test('rejects a set that is both internally referenced by another set and explicitly ordered', () => {
    // If set "extended" references "base" internally AND "base" is ALSO
    // listed explicitly in resolutionOrder alongside a modifier
    // ("extended, theme, base"), "base"'s values get applied twice --
    // once via extended's own expansion, once again via its explicit
    // position AFTER the theme modifier, silently resetting whatever the
    // modifier just overrode. buildTokensBaseCss and the resolved-context
    // snapshots would then disagree about which value wins. Reject the
    // combination outright rather than let that disagreement surface later.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          extended: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/extra.tokens.json' }] },
        },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
          },
        },
        resolutionOrder: [
          { $ref: '#/sets/extended' },
          { $ref: '#/modifiers/theme' },
          { $ref: '#/sets/base' },
        ],
      }),
    ).toThrow(
      /set "base" is already referenced internally by another ordered set and must not also appear in resolutionOrder/,
    );
  });

  test('rejects a child set referenced internally by two different ordered parent sets', () => {
    // Neither "base" itself nor a duplicate of it appears in resolutionOrder
    // here -- the single-parent-plus-explicit-listing check above doesn't
    // catch this shape. Both "a" and "c" (directly ordered, with a modifier
    // between them) reference "base" internally, so its values get expanded
    // twice: once via "a", again via "c" after the modifier, resetting
    // whatever the modifier just overrode -- the same CSS-vs-resolved-JSON
    // disagreement, reached a different way.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          a: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/a.tokens.json' }] },
          c: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/c.tokens.json' }] },
        },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
          },
        },
        resolutionOrder: [
          { $ref: '#/sets/a' },
          { $ref: '#/modifiers/theme' },
          { $ref: '#/sets/c' },
        ],
      }),
    ).toThrow(
      /set "base" is reachable from more than one ordered set \(a, c\) and would be expanded more than once/,
    );
  });

  test('rejects a child set reachable from two ordered positions through a CHAIN of internal references', () => {
    // "base" is referenced directly by "a" (ordered), and also transitively
    // by "wrapper" (ordered) -> "b" -> "base". "base"'s only DIRECT parents
    // are "a" and "b", and only "a" is itself ordered -- a direct-parents-only
    // check sees no conflict, but "wrapper"'s own recursive expansion still
    // pulls "base" in a second time. Both ordered positions genuinely
    // contribute "base" to the resolved tree, so this must be rejected the
    // same as the direct two-ordered-parents case.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          a: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/a.tokens.json' }] },
          b: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/b.tokens.json' }] },
          wrapper: { sources: [{ $ref: '#/sets/b' }, { $ref: 'sets/wrapper.tokens.json' }] },
        },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/a' }, { $ref: '#/sets/wrapper' }],
      }),
    ).toThrow(
      /set "base" is reachable from more than one ordered set \(a, wrapper\) and would be expanded more than once/,
    );
  });

  test('accepts a set referenced by a non-ordered set that is itself unreachable from any other ordered position', () => {
    // "base" is referenced only by "a" (ordered) -- a second reference from
    // an entirely disconnected part of the graph is not constructible here,
    // since every set must ultimately trace back to some ordered ancestor
    // (the "must list every set and modifier exactly once" check already
    // enforces that) -- so this just confirms the ordinary single-ordered-
    // ancestor case, with an unrelated standalone set alongside it, is fine.
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: {
          base: { sources: [{ $ref: 'sets/base.tokens.json' }] },
          a: { sources: [{ $ref: '#/sets/base' }, { $ref: 'sets/a.tokens.json' }] },
          standalone: { sources: [{ $ref: 'sets/standalone.tokens.json' }] },
        },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/a' }, { $ref: '#/sets/standalone' }],
      }),
    ).not.toThrow();
  });

  test('rejects the pre-2025.10-conformant array-based resolver shape Cinder used to author', () => {
    // Regression guard: cinder.resolver.json used to declare
    // sets/modifiers as arrays of {name, ...} objects and resolutionOrder as
    // a plain string array. That shape never conformed to the official
    // DTCG 2025.10 resolver schema (sets/modifiers must be objects keyed by
    // name; resolutionOrder entries must be $ref objects) even though the
    // file declared the official $schema URI. CIN-27 migrated the real
    // corpus file to the conformant shape; this test locks out sliding back.
    const oldShapeDocument = {
      version: '2025.10',
      sets: [{ name: 'foundation', source: ['sets/foundation.tokens.json'] }],
      modifiers: [{ name: 'theme', values: ['light', 'dark'], default: 'light' }],
      resolutionOrder: ['theme'],
    };
    let caught: unknown;
    try {
      assertValidResolverDocument(oldShapeDocument);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TokenValidationError);
    const issues = (caught as TokenValidationError).issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.path === '$.sets' && issue.reason.includes('object'))).toBe(
      true,
    );
    expect(
      issues.some((issue) => issue.path === '$.modifiers' && issue.reason.includes('object')),
    ).toBe(true);
  });
});
