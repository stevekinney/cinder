import { describe, expect, test } from 'bun:test';

import {
  deselectIds,
  selectableIds,
  selectIds,
  selectionStateFor,
  toggleIndependentId,
  toggleSelectionScope,
  uniqueIds,
} from './tree-selection.ts';

describe('tree selection helpers', () => {
  test('deduplicates ids while preserving first-seen order', () => {
    expect(uniqueIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  test('filters disabled ids from selectable scopes', () => {
    expect(selectableIds(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c']);
  });

  test('empty target scope is unchecked and not indeterminate', () => {
    expect(selectionStateFor(['a'], [])).toEqual({ checked: false, indeterminate: false });
  });

  test('unchecked state when no target ids are selected', () => {
    expect(selectionStateFor(['x'], ['a', 'b'])).toEqual({
      checked: false,
      indeterminate: false,
    });
  });

  test('checked state when every selectable target id is selected', () => {
    expect(selectionStateFor(['x', 'a', 'b'], ['a', 'b'])).toEqual({
      checked: true,
      indeterminate: false,
    });
  });

  test('mixed state when some selectable target ids are selected', () => {
    expect(selectionStateFor(['a'], ['a', 'b'])).toEqual({
      checked: false,
      indeterminate: true,
    });
  });

  test('all-disabled scope behaves as empty', () => {
    expect(selectionStateFor(['a'], ['a'], new Set(['a']))).toEqual({
      checked: false,
      indeterminate: false,
    });
  });

  test('select appends missing ids and preserves existing order', () => {
    expect(selectIds(['z', 'a'], ['b', 'a', 'c'])).toEqual(['z', 'a', 'b', 'c']);
  });

  test('select skips disabled ids', () => {
    expect(selectIds(['z'], ['a', 'b', 'c'], new Set(['b']))).toEqual(['z', 'a', 'c']);
  });

  test('deselect removes only target ids and preserves other ids', () => {
    expect(deselectIds(['z', 'a', 'b', 'c'], ['a', 'c'])).toEqual(['z', 'b']);
  });

  test('independent toggle changes only the target id', () => {
    expect(toggleIndependentId(['a', 'x'], 'a')).toEqual(['x']);
    expect(toggleIndependentId(['x'], 'a')).toEqual(['x', 'a']);
  });

  test('independent toggle no-ops for disabled target ids', () => {
    expect(toggleIndependentId(['x'], 'a', new Set(['a']))).toEqual(['x']);
  });

  test('scope toggle selects all selectable ids when not fully selected', () => {
    expect(toggleSelectionScope(['a', 'x'], ['a', 'b', 'c'])).toEqual(['a', 'x', 'b', 'c']);
  });

  test('scope toggle clears selectable ids when fully selected', () => {
    expect(toggleSelectionScope(['x', 'a', 'b', 'c'], ['a', 'b', 'c'])).toEqual(['x']);
  });

  test('scope toggle preserves unknown selected ids outside the operation scope', () => {
    expect(toggleSelectionScope(['unknown', 'a'], ['a', 'b'])).toEqual(['unknown', 'a', 'b']);
    expect(toggleSelectionScope(['unknown', 'a', 'b'], ['a', 'b'])).toEqual(['unknown']);
  });

  test('scope toggle no-ops for empty or all-disabled scopes', () => {
    expect(toggleSelectionScope(['x'], [])).toEqual(['x']);
    expect(toggleSelectionScope(['x'], ['a'], new Set(['a']))).toEqual(['x']);
  });
});
