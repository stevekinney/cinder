/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');

describe('Tabs roving tabindex with disabled tabs', () => {
  test('selected-disabled at mount: first enabled tab gets tabindex="0"', () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'a', items: navigationItems });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    // `a` is selected but disabled, so the tab stop moves to the first enabled (`b`).
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
  });

  test('selected tab becomes disabled: tabindex="0" moves to first enabled', async () => {
    const initialItems = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container, rerender } = render(Wrapper, { value: 'a', items: initialItems });
    let tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');

    await rerender({
      value: 'a',
      items: [
        { value: 'a', title: 'A tab', body: 'A body', disabled: true },
        { value: 'b', title: 'B tab', body: 'B body' },
        { value: 'c', title: 'C tab', body: 'C body' },
      ],
    });
    tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    // Selection preserved; tabindex moved.
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
  });

  test('all-disabled: no tab gets tabindex="0"', () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items: navigationItems });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
  });
});
