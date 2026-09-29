import { describe, expect, test } from 'bun:test';
import type { DataGridColumnPin } from '../data-grid.types.ts';
import {
  clampColumnWidth,
  getKeyboardResizedColumnWidth,
  getPointerResizedColumnWidth,
  moveColumnKeyWithinPinGroup,
  reorderColumnKeyBeforeOrAfter,
} from './column-interaction-model.ts';

describe('clampColumnWidth', () => {
  test('leaves widths inside the bounds untouched', () => {
    expect(clampColumnWidth(120, 60, 200)).toBe(120);
  });

  test('clamps below minWidth up to minWidth', () => {
    expect(clampColumnWidth(10, 60, 200)).toBe(60);
  });

  test('clamps above maxWidth down to maxWidth', () => {
    expect(clampColumnWidth(500, 60, 200)).toBe(200);
  });

  test('treats an undefined maxWidth as unbounded', () => {
    expect(clampColumnWidth(10_000, 60, undefined)).toBe(10_000);
  });
});

describe('getPointerResizedColumnWidth', () => {
  test('adds a positive delta and clamps to minWidth/maxWidth', () => {
    expect(getPointerResizedColumnWidth(150, 40, 60, 300)).toBe(190);
    expect(getPointerResizedColumnWidth(150, -1_000, 60, 300)).toBe(60);
    expect(getPointerResizedColumnWidth(150, 1_000, 60, 300)).toBe(300);
  });
});

describe('getKeyboardResizedColumnWidth', () => {
  test('widens by the default 10px step', () => {
    expect(getKeyboardResizedColumnWidth(150, 1, 60, undefined)).toBe(160);
  });

  test('narrows by the default 10px step', () => {
    expect(getKeyboardResizedColumnWidth(150, -1, 60, undefined)).toBe(140);
  });

  test('clamps a narrow step at minWidth', () => {
    expect(getKeyboardResizedColumnWidth(65, -1, 60, undefined)).toBe(60);
  });

  test('clamps a widen step at maxWidth', () => {
    expect(getKeyboardResizedColumnWidth(295, 1, 60, 300)).toBe(300);
  });

  test('accepts a custom step', () => {
    expect(getKeyboardResizedColumnWidth(150, 1, 60, undefined, 25)).toBe(175);
  });
});

describe('reorderColumnKeyBeforeOrAfter', () => {
  const pinByKey = new Map<string, DataGridColumnPin | undefined>([
    ['left-1', 'left'],
    ['left-2', 'left'],
    ['mid-1', undefined],
    ['mid-2', undefined],
    ['mid-3', undefined],
    ['right-1', 'right'],
  ]);
  const order = ['left-1', 'left-2', 'mid-1', 'mid-2', 'mid-3', 'right-1'];

  test('moves a column before its target within the same pin group', () => {
    const next = reorderColumnKeyBeforeOrAfter(order, pinByKey, 'mid-3', 'mid-1', 'before');
    expect(next).toEqual(['left-1', 'left-2', 'mid-3', 'mid-1', 'mid-2', 'right-1']);
  });

  test('moves a column after its target within the same pin group', () => {
    const next = reorderColumnKeyBeforeOrAfter(order, pinByKey, 'mid-1', 'mid-3', 'after');
    expect(next).toEqual(['left-1', 'left-2', 'mid-2', 'mid-3', 'mid-1', 'right-1']);
  });

  test('reorders left-pinned columns among themselves without disturbing other groups', () => {
    const next = reorderColumnKeyBeforeOrAfter(order, pinByKey, 'left-2', 'left-1', 'before');
    expect(next).toEqual(['left-2', 'left-1', 'mid-1', 'mid-2', 'mid-3', 'right-1']);
  });

  test('refuses to move a column across pin groups', () => {
    expect(
      reorderColumnKeyBeforeOrAfter(order, pinByKey, 'left-1', 'mid-1', 'before'),
    ).toBeUndefined();
    expect(
      reorderColumnKeyBeforeOrAfter(order, pinByKey, 'mid-1', 'right-1', 'after'),
    ).toBeUndefined();
  });

  test('is a no-op for a drop that would not change the order', () => {
    expect(
      reorderColumnKeyBeforeOrAfter(order, pinByKey, 'mid-1', 'mid-2', 'before'),
    ).toBeUndefined();
  });

  test('is a no-op when dragged and target are the same column', () => {
    expect(
      reorderColumnKeyBeforeOrAfter(order, pinByKey, 'mid-1', 'mid-1', 'after'),
    ).toBeUndefined();
  });

  test('is a no-op for an unknown key', () => {
    expect(
      reorderColumnKeyBeforeOrAfter(order, pinByKey, 'missing', 'mid-1', 'before'),
    ).toBeUndefined();
  });
});

describe('moveColumnKeyWithinPinGroup', () => {
  const pinByKey = new Map<string, DataGridColumnPin | undefined>([
    ['left-1', 'left'],
    ['left-2', 'left'],
    ['mid-1', undefined],
    ['mid-2', undefined],
    ['right-1', 'right'],
  ]);
  const order = ['left-1', 'left-2', 'mid-1', 'mid-2', 'right-1'];

  test('moves a column one step later within its pin group', () => {
    const next = moveColumnKeyWithinPinGroup(order, pinByKey, 'mid-1', 1);
    expect(next).toEqual(['left-1', 'left-2', 'mid-2', 'mid-1', 'right-1']);
  });

  test('moves a column one step earlier within its pin group', () => {
    const next = moveColumnKeyWithinPinGroup(order, pinByKey, 'left-2', -1);
    expect(next).toEqual(['left-2', 'left-1', 'mid-1', 'mid-2', 'right-1']);
  });

  test('is a no-op at the trailing edge of the pin group', () => {
    expect(moveColumnKeyWithinPinGroup(order, pinByKey, 'mid-2', 1)).toBeUndefined();
  });

  test('is a no-op at the leading edge of the pin group', () => {
    expect(moveColumnKeyWithinPinGroup(order, pinByKey, 'left-1', -1)).toBeUndefined();
  });

  test('a single-member pin group never moves', () => {
    expect(moveColumnKeyWithinPinGroup(order, pinByKey, 'right-1', 1)).toBeUndefined();
    expect(moveColumnKeyWithinPinGroup(order, pinByKey, 'right-1', -1)).toBeUndefined();
  });

  test('is a no-op for an unknown key', () => {
    expect(moveColumnKeyWithinPinGroup(order, pinByKey, 'missing', 1)).toBeUndefined();
  });
});
