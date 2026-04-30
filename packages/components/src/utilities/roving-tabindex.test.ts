import { describe, expect, test } from 'bun:test';

import { getFocusableIndex, handleRovingKeydown, isRovingKey } from './roving-tabindex.ts';

function createKeyEvent(key: string): KeyboardEvent {
  return { key } as KeyboardEvent;
}

function isSecondItemDisabled(index: number): boolean {
  return index === 1;
}

describe('roving tabindex utilities', () => {
  test('identifies navigation keys', () => {
    expect(isRovingKey('ArrowLeft')).toBe(true);
    expect(isRovingKey('ArrowRight')).toBe(true);
    expect(isRovingKey('ArrowUp')).toBe(true);
    expect(isRovingKey('ArrowDown')).toBe(true);
    expect(isRovingKey('Home')).toBe(true);
    expect(isRovingKey('End')).toBe(true);
    expect(isRovingKey('Enter')).toBe(false);
  });

  test('moves through items with wraparound', () => {
    expect(handleRovingKeydown(createKeyEvent('ArrowRight'), 0, 3)).toBe(1);
    expect(handleRovingKeydown(createKeyEvent('ArrowLeft'), 0, 3)).toBe(2);
    expect(handleRovingKeydown(createKeyEvent('Home'), 2, 3)).toBe(0);
    expect(handleRovingKeydown(createKeyEvent('End'), 0, 3)).toBe(2);
  });

  test('skips disabled items', () => {
    expect(
      handleRovingKeydown(createKeyEvent('ArrowRight'), 0, 3, {
        isDisabled: isSecondItemDisabled,
      }),
    ).toBe(2);
    expect(getFocusableIndex(-1, 3, (index) => index === 0)).toBe(1);
  });

  test('respects directional options and empty lists', () => {
    expect(
      handleRovingKeydown(createKeyEvent('ArrowRight'), 0, 3, {
        horizontal: false,
      }),
    ).toBeNull();
    expect(handleRovingKeydown(createKeyEvent('ArrowRight'), 0, 0)).toBeNull();
    expect(getFocusableIndex(0, 0)).toBe(-1);
  });
});
