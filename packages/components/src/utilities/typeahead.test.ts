import { describe, expect, test } from 'bun:test';

import { findTypeaheadMatch, isTypeaheadKey, TypeaheadBuffer } from './typeahead.ts';

const candidates = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'archive', label: 'Archive', disabled: true },
];

describe('findTypeaheadMatch', () => {
  test('returns undefined when there are no candidates', () => {
    expect(findTypeaheadMatch([], 'a', -1)).toBeUndefined();
  });

  test('starts at the first candidate when no current item is active', () => {
    expect(findTypeaheadMatch(candidates, 'a', -1)).toBe('alpha');
  });

  test('searches after the current item and wraps around', () => {
    expect(findTypeaheadMatch(candidates, 'a', 0)).toBe('apricot');
    expect(findTypeaheadMatch(candidates, 'b', 2)).toBe('beta');
  });

  test('skips disabled candidates', () => {
    expect(findTypeaheadMatch(candidates, 'ar', -1)).toBeUndefined();
  });

  test('matches prefixes without case sensitivity', () => {
    expect(findTypeaheadMatch(candidates, 'AL', -1)).toBe('alpha');
  });
});

describe('TypeaheadBuffer', () => {
  test('clears safely before any timer is registered', () => {
    expect(() => new TypeaheadBuffer().clearTimer()).not.toThrow();
  });

  test('accumulates lowercase prefix characters until reset', () => {
    const buffer = new TypeaheadBuffer();

    expect(buffer.push('A')).toBe('a');
    expect(buffer.push('p')).toBe('ap');
    buffer.reset();
    expect(buffer.push('B')).toBe('b');
    buffer.reset();
  });

  test('resets itself after the idle timeout', async () => {
    const buffer = new TypeaheadBuffer();

    expect(buffer.push('A')).toBe('a');
    await new Promise((resolve) => setTimeout(resolve, 520));
    expect(buffer.push('B')).toBe('b');
    buffer.reset();
  });
});

describe('isTypeaheadKey', () => {
  test('accepts printable non-space characters', () => {
    expect(isTypeaheadKey({ key: 'a' } as KeyboardEvent)).toBe(true);
  });

  test('ignores Space so native menu item activation still works', () => {
    expect(isTypeaheadKey({ key: ' ' } as KeyboardEvent)).toBe(false);
  });

  test('ignores printable keys with modifiers or active composition', () => {
    expect(isTypeaheadKey({ key: 'a', ctrlKey: true } as KeyboardEvent)).toBe(false);
    expect(isTypeaheadKey({ key: 'a', metaKey: true } as KeyboardEvent)).toBe(false);
    expect(isTypeaheadKey({ key: 'a', altKey: true } as KeyboardEvent)).toBe(false);
    expect(isTypeaheadKey({ key: 'a', isComposing: true } as KeyboardEvent)).toBe(false);
  });
});
