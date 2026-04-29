/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import {
  createMultiSelection,
  createSingleSelection,
  navigationIntent,
  nextIndex,
  rovingTabIndex,
} from './collection.ts';

describe('navigationIntent', () => {
  test('Home and End are orientation-independent', () => {
    expect(navigationIntent('Home', 'horizontal')).toBe('first');
    expect(navigationIntent('Home', 'vertical')).toBe('first');
    expect(navigationIntent('End', 'horizontal')).toBe('last');
    expect(navigationIntent('End', 'vertical')).toBe('last');
  });

  test('horizontal orientation maps left/right to previous/next', () => {
    expect(navigationIntent('ArrowRight', 'horizontal')).toBe('next');
    expect(navigationIntent('ArrowLeft', 'horizontal')).toBe('previous');
    expect(navigationIntent('ArrowDown', 'horizontal')).toBeNull();
    expect(navigationIntent('ArrowUp', 'horizontal')).toBeNull();
  });

  test('vertical orientation maps down/up to next/previous', () => {
    expect(navigationIntent('ArrowDown', 'vertical')).toBe('next');
    expect(navigationIntent('ArrowUp', 'vertical')).toBe('previous');
    expect(navigationIntent('ArrowRight', 'vertical')).toBeNull();
    expect(navigationIntent('ArrowLeft', 'vertical')).toBeNull();
  });

  test('unrelated keys return null', () => {
    expect(navigationIntent('Tab', 'horizontal')).toBeNull();
    expect(navigationIntent('Enter', 'horizontal')).toBeNull();
    expect(navigationIntent('a', 'horizontal')).toBeNull();
  });
});

describe('nextIndex', () => {
  test('first/last jump to boundaries', () => {
    expect(nextIndex(2, 5, 'first')).toBe(0);
    expect(nextIndex(2, 5, 'last')).toBe(4);
  });

  test('next wraps around at the end', () => {
    expect(nextIndex(0, 3, 'next')).toBe(1);
    expect(nextIndex(2, 3, 'next')).toBe(0);
  });

  test('previous wraps around at the start', () => {
    expect(nextIndex(2, 3, 'previous')).toBe(1);
    expect(nextIndex(0, 3, 'previous')).toBe(2);
  });

  test('returns the same index when length is 0', () => {
    expect(nextIndex(0, 0, 'next')).toBe(0);
    expect(nextIndex(5, 0, 'last')).toBe(5);
  });
});

describe('createSingleSelection', () => {
  test('select replaces the value', () => {
    let v = 'a';
    const s = createSingleSelection(
      () => v,
      (next) => {
        v = next;
      },
    );
    expect(s.value).toBe('a');
    s.select('b');
    expect(s.value).toBe('b');
    expect(v).toBe('b');
  });

  test('isSelected reflects the current value', () => {
    let v = 'a';
    const s = createSingleSelection(
      () => v,
      (next) => {
        v = next;
      },
    );
    expect(s.isSelected('a')).toBe(true);
    expect(s.isSelected('b')).toBe(false);
    s.select('b');
    expect(s.isSelected('a')).toBe(false);
    expect(s.isSelected('b')).toBe(true);
  });
});

describe('createMultiSelection', () => {
  test('toggle adds an absent item', () => {
    let arr: string[] = [];
    const m = createMultiSelection<string>(
      () => arr,
      (next) => {
        arr = next;
      },
    );
    m.toggle('a');
    expect(arr).toEqual(['a']);
    m.toggle('b');
    expect(arr).toEqual(['a', 'b']);
  });

  test('toggle removes a present item', () => {
    let arr: string[] = ['a', 'b'];
    const m = createMultiSelection<string>(
      () => arr,
      (next) => {
        arr = next;
      },
    );
    m.toggle('a');
    expect(arr).toEqual(['b']);
  });

  test('isSelected reflects the current set', () => {
    let arr: string[] = ['a'];
    const m = createMultiSelection<string>(
      () => arr,
      (next) => {
        arr = next;
      },
    );
    expect(m.isSelected('a')).toBe(true);
    expect(m.isSelected('b')).toBe(false);
  });

  test('setter receives a fresh array, not a mutated original', () => {
    const initial: string[] = ['a'];
    let received: string[] = initial;
    const m = createMultiSelection<string>(
      () => received,
      (next) => {
        received = next;
      },
    );
    m.toggle('b');
    expect(received).not.toBe(initial);
    expect(initial).toEqual(['a']);
  });
});

describe('rovingTabIndex', () => {
  test('active item gets 0', () => {
    expect(rovingTabIndex(true)).toBe(0);
  });

  test('inactive item gets -1', () => {
    expect(rovingTabIndex(false)).toBe(-1);
  });
});
