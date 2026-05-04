import { describe, expect, test } from 'bun:test';

import { reconcileCompositionBranchKeys } from './composition-branch-keys.ts';

describe('reconcileCompositionBranchKeys', () => {
  function keyGenerator() {
    let next = 1;
    return () => `branch-${next++}`;
  }

  test('creates one stable key per branch from an empty start', () => {
    const createKey = keyGenerator();

    expect(reconcileCompositionBranchKeys([], 3, createKey)).toEqual([
      'branch-1',
      'branch-2',
      'branch-3',
    ]);
  });

  test('preserves existing keys when branch values are immutably replaced', () => {
    const createKey = keyGenerator();
    const original = reconcileCompositionBranchKeys([], 2, createKey);

    const next = reconcileCompositionBranchKeys(original, 2, createKey);

    expect(next).toEqual(original);
  });

  test('truncates stale keys after removals', () => {
    const createKey = keyGenerator();

    expect(reconcileCompositionBranchKeys(['branch-1', 'branch-3'], 1, createKey)).toEqual([
      'branch-1',
    ]);
  });

  test('appends keys without replacing surviving keys', () => {
    const createKey = keyGenerator();

    const next = reconcileCompositionBranchKeys(['branch-a'], 3, createKey);

    expect(next).toEqual(['branch-a', 'branch-1', 'branch-2']);
  });
});
