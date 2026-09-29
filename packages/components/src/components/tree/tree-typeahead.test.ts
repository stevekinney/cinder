/// <reference lib="dom" />
import {
  expectNoLeakedTimers,
  requiredInstance,
  setupHappyDom,
  trackTimers,
} from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

afterEach(() => cleanup());

describe('Tree — typeahead', () => {
  test('typing a character focuses next item starting with that char', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([
          { id: 'banana', label: 'Banana' },
          { id: 'apple', label: 'Apple' },
          { id: 'avocado', label: 'Avocado' },
        ]),
      },
    });
    const banana = requiredInstance(treeItem(container, 'Banana'), HTMLElement);
    banana.focus();
    await fireEvent.keyDown(banana, { key: 'a' });
    const apple = treeItem(container, 'Apple');
    expect(apple?.getAttribute('tabindex')).toBe('0');
  });

  test('unmounting before the reset timer fires leaves no leaked timer', async () => {
    // handleTypeahead schedules a 500 ms setTimeout to clear typeaheadBuffer.
    // The $effect cleanup in tree.svelte must clearTimeout on destroy —
    // otherwise the callback fires against an unmounted component.
    const timers = trackTimers();
    try {
      const { container, unmount } = render(Tree, {
        props: {
          'aria-label': 'T',
          children: treeItemsSnippet([
            { id: 'banana', label: 'Banana' },
            { id: 'apple', label: 'Apple' },
          ]),
        },
      });

      // Fire a single printable-character keydown on the first treeitem to
      // trigger handleTypeahead, which schedules typeaheadTimer = setTimeout(..., 500).
      const firstItem = requiredInstance(treeItem(container, 'Banana'), HTMLElement);
      firstItem.focus();
      await fireEvent.keyDown(firstItem, { key: 'a' });

      // Unmount immediately — the 500 ms timer is still pending.
      unmount();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });

  test('typeaheadDisabled prevents typeahead from moving focus', async () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        typeaheadDisabled: true,
        children: treeItemsSnippet([
          { id: 'banana', label: 'Banana' },
          { id: 'apple', label: 'Apple' },
        ]),
      },
    });
    const banana = requiredInstance(treeItem(container, 'Banana'), HTMLElement);
    banana.focus();
    await fireEvent.keyDown(banana, { key: 'a' });
    // Banana should still be focused (typeahead disabled)
    expect(banana.getAttribute('tabindex')).toBe('0');
  });
});
