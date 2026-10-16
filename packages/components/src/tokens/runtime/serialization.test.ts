import { describe, expect, test } from 'bun:test';

import type { CorpusEntry } from './corpus.ts';
import { stylelintDisableCommentFor } from './css-stylelint.ts';
import { renderBaseDeclarations, renderOverrideDeclarations } from './css-support.ts';
import { buildTokenRegistryFromIndexes, serializeTokenRegistry } from './registry.ts';
import { serializeEntryValue } from './value-entry.ts';
import { serializeTypedValue } from './value-formatters.ts';

function entry(path: string, overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    path,
    value: '1px',
    type: 'dimension',
    description: undefined,
    cssProperty: `--cinder-${path}`,
    cssRecipe: undefined,
    public: true,
    ...overrides,
  };
}

const identity = (value: unknown) => value;

describe('color serialization', () => {
  const color = (extra: Record<string, unknown>) =>
    serializeTypedValue(
      'color',
      { colorSpace: 'srgb', components: [0.1, 0.2, 0.3], ...extra },
      'c',
    );

  test('keeps a hex literal that cannot be written in shorthand as it is', () => {
    expect(color({ hex: '#123456' })).toBe('#123456');
    expect(color({ hex: '#FFFFFF' })).toBe('#fff');
  });

  test('refuses a color space it has no serialization for, naming the space', () => {
    expect(() =>
      serializeTypedValue('color', { colorSpace: 'cmyk', components: [0, 0, 0] }, 'c'),
    ).toThrow('No direct CSS serialization implemented for color colorSpace "cmyk"');
  });
});

describe('entry serialization', () => {
  test('refuses an entry with neither a type nor a recipe', () => {
    expect(() => serializeEntryValue(entry('plain', { type: undefined }), new Map())).toThrow(
      'Token at "plain" has no $type and no cssRecipe; cannot serialize.',
    );
  });
});

describe('stylesheet declaration rendering', () => {
  test('flags the canonical status-mixing formula for the stylelint exemption', () => {
    const mixed = 'color-mix(in oklch, var(--cinder-danger), transparent 50%)';
    expect(stylelintDisableCommentFor(mixed)).toContain('stylelint-disable-next-line');
    expect(stylelintDisableCommentFor('var(--cinder-text-default)')).toBeUndefined();
  });

  test('rejects a base token that declares no custom property', () => {
    const base = new Map([['a', entry('a', { cssProperty: undefined })]]);
    expect(() => renderBaseDeclarations(base, identity)).toThrow(
      'Base corpus token at "a" has no cssProperty extension.',
    );
  });

  test('rejects an override with no matching base token', () => {
    const overrides = new Map([['a', entry('a')]]);
    expect(() => renderOverrideDeclarations(overrides, new Map(), identity)).toThrow(
      'Override token at "a" has no matching base token with a cssProperty.',
    );
  });

  test('adds the stylelint exemption above an override that mixes a status color', () => {
    const base = new Map([['a', entry('a', { type: 'color' })]]);
    const overrides = new Map([
      [
        'a',
        entry('a', {
          type: 'color',
          cssRecipe: 'color-mix(in oklch, var(--cinder-success), transparent 40%)',
        }),
      ],
    ]);
    expect(renderOverrideDeclarations(overrides, base, identity)).toContain(
      'stylelint-disable-next-line',
    );
  });
});

describe('the token registry', () => {
  const build = (...entries: CorpusEntry[]) =>
    buildTokenRegistryFromIndexes(
      new Map(entries.map((candidate) => [candidate.path, candidate])),
      new Set(),
    );

  test.each([
    ['no cssProperty', { cssProperty: undefined }, 'has no cssProperty extension'],
    ['no public flag', { public: undefined }, 'has no public extension'],
    ['a blank category', { category: '  ' }, 'has a blank category extension'],
    ['a blank component', { component: '' }, 'has a blank component extension'],
  ])('rejects a base token with %s', (_label, overrides, message) => {
    expect(() => build(entry('a', overrides))).toThrow(message);
  });

  test('serializes to the JSON the generator commits', () => {
    const registry = build(entry('a', { category: 'space', component: 'card' }));
    expect(JSON.parse(serializeTokenRegistry(registry))).toEqual(
      JSON.parse(JSON.stringify(registry)),
    );
    expect(registry.entries.map((candidate) => candidate.cssProperty)).toEqual(['--cinder-a']);
  });
});
