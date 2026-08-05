/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { TreeFilterController } = await import('./tree-filter.svelte.ts');

describe('TreeFilterController', () => {
  test('update() sets currentValue and is idempotent when called with the same value twice', () => {
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
