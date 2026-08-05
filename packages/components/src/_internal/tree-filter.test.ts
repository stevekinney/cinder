/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { TreeFilterController } = await import('./tree-filter.svelte.ts');

describe('TreeFilterController', () => {
  test('update() tracks currentValue and forwards every call to onFilterChange, including repeats', () => {
    const calls: string[] = [];
    const controller = new TreeFilterController({
      getFilterValue: () => undefined,
      isControlled: () => false,
      onFilterChange: (value) => calls.push(value),
      focusFirstVisible: () => {},
    });

    controller.update('alpha');
    expect(controller.currentValue).toBe('alpha');

    controller.update('alpha');
    expect(controller.currentValue).toBe('alpha');
    expect(calls).toEqual(['alpha', 'alpha']);
  });
});
