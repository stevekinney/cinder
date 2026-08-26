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

  test('rejects a $ref token alias by name rather than as unknown metadata', () => {
    // The official format schema accepts `$ref` in place of `$value`, but
    // Cinder classifies tokens by `$value` alone, so the two layers disagree.
    // Support is tracked in CIN-463; until then the rejection must say so
    // rather than reporting a spec property as an unknown one.
    expect(() =>
      validateTokenDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $ref: '#/base' },
      }),
    ).toThrow(/\$ref token aliases are not supported yet \(CIN-463\)/);
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
