import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: TreeAttachFixture } =
  await import('../../test/fixtures/tree-attach-fixture.svelte');

describe('Tree — attachment registration', () => {
  test('arrow keys walk items in DOM order after the middle item remounts', async () => {
    const { container, rerender } = render(TreeAttachFixture, {
      props: { ids: ['a', 'b', 'c'], showMiddle: true },
    });

    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);

    // Unmount the middle item; navigation should now skip over the missing slot.
    await rerender({ ids: ['a', 'b', 'c'], showMiddle: false });
    await waitFor(() => {
      expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
    });

    const a = requiredInstance(treeItem(container, 'a'), HTMLElement);
    a.focus();
    await fireEvent.keyDown(a, { key: 'ArrowDown' });
    const c = requiredInstance(treeItem(container, 'c'), HTMLElement);
    expect(c.getAttribute('tabindex')).toBe('0');

    // Remount the middle item; navigation should once again include it.
    await rerender({ ids: ['a', 'b', 'c'], showMiddle: true });
    await waitFor(() => {
      expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
    });

    const aAgain = requiredInstance(treeItem(container, 'a'), HTMLElement);
    aAgain.focus();
    await fireEvent.keyDown(aAgain, { key: 'ArrowDown' });
    const b = requiredInstance(treeItem(container, 'b'), HTMLElement);
    expect(b.getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(b, { key: 'ArrowDown' });
    const cAgain = requiredInstance(treeItem(container, 'c'), HTMLElement);
    expect(cAgain.getAttribute('tabindex')).toBe('0');
  });

  test('conditional item unmount/remount returns the registry to baseline', async () => {
    const { container, rerender } = render(TreeAttachFixture, {
      props: { ids: ['a', 'b', 'c'], showMiddle: true },
    });

    const baseline = container.querySelectorAll('[role="treeitem"]').length;
    expect(baseline).toBe(3);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await rerender({ ids: ['a', 'b', 'c'], showMiddle: false });
      await waitFor(() => {
        expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(baseline - 1);
      });
      await rerender({ ids: ['a', 'b', 'c'], showMiddle: true });
      await waitFor(() => {
        expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(baseline);
      });
    }

    // After the cycles, ArrowDown still visits each item in DOM order.
    const a = requiredInstance(treeItem(container, 'a'), HTMLElement);
    a.focus();
    await fireEvent.keyDown(a, { key: 'ArrowDown' });
    const b = requiredInstance(treeItem(container, 'b'), HTMLElement);
    expect(b.getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(b, { key: 'ArrowDown' });
    const c = requiredInstance(treeItem(container, 'c'), HTMLElement);
    expect(c.getAttribute('tabindex')).toBe('0');
  });
});
