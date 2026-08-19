import { describe, expect, test } from 'bun:test';
import { TokenValidationError, type TokenDocument } from './types.ts';
import {
  validateResolvedToken,
  validateResolverDocument,
  validateTokenDocument,
} from './validate.ts';

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
  { type: 'gradient', value: [{ color: '{color}', position: 0 }] },
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
  });

  test('rejects negative durations', () => {
    expect(() =>
      validateTokenDocument({ duration: { $type: 'duration', $value: { value: -1, unit: 'ms' } } }),
    ).toThrow('non-negative');
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
        sets: [{ name: 'base', source: ['sets/base.tokens.json'] }],
        modifiers: [{ name: 'theme', values: ['light', 'dark'], default: 'light' }],
        resolutionOrder: ['theme'],
      }),
    ).not.toThrow();
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: [],
        modifiers: [],
        resolutionOrder: ['theme'],
      }),
    ).toThrow('unknown modifier');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: [
          { name: 'base', source: ['sets/base.tokens.json'] },
          { name: 'base', source: ['sets/other.tokens.json'] },
        ],
        modifiers: [],
        resolutionOrder: [],
      }),
    ).toThrow('set names must be unique');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: [{ name: 'base', source: ['sets/base.tokens.json'] }],
        modifiers: [{ name: 'theme', values: [] }],
        resolutionOrder: ['theme'],
      }),
    ).toThrow('modifier values must not be empty');
    expect(() =>
      validateResolverDocument({
        version: '2025.10',
        sets: [{ name: 'base', source: ['sets/base.tokens.json'] }],
        modifiers: [{ name: 'theme', values: ['light', 'dark'] }],
        resolutionOrder: [],
      }),
    ).toThrow('must list every modifier exactly once');
  });
});
