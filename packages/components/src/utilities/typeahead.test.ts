import { describe, expect, jest, spyOn, test } from 'bun:test';

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

  test('resets itself after the idle timeout', () => {
    jest.useFakeTimers();
    const schedule = spyOn(globalThis, 'setTimeout');
    const buffer = new TypeaheadBuffer();

    try {
      expect(buffer.push('A')).toBe('a');
      expect(schedule.mock.calls[0]?.[1]).toBe(500);
      expect(schedule.mock.calls[0]?.[0]).toBeTypeOf('function');
      jest.advanceTimersByTime(500);
      expect(buffer.push('B')).toBe('b');
      expect(schedule.mock.calls[1]?.[1]).toBe(500);
      buffer.reset();
    } finally {
      schedule.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('isTypeaheadKey', () => {
  test('accepts printable non-space characters', () => {
    expect(isTypeaheadKey(new KeyboardEvent('keydown', { key: 'a' }))).toBe(true);
  });

  test('ignores Space so native menu item activation still works', () => {
    expect(isTypeaheadKey(new KeyboardEvent('keydown', { key: ' ' }))).toBe(false);
  });

  test('ignores printable keys with modifiers or active composition', () => {
    expect(isTypeaheadKey(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))).toBe(false);
    expect(isTypeaheadKey(new KeyboardEvent('keydown', { key: 'a', metaKey: true }))).toBe(false);
    expect(isTypeaheadKey(new KeyboardEvent('keydown', { key: 'a', altKey: true }))).toBe(false);
    expect(isTypeaheadKey(new KeyboardEvent('keydown', { key: 'a', isComposing: true }))).toBe(
      false,
    );
  });
});
