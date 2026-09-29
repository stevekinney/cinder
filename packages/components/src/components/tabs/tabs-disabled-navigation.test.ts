/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');

const withDisabledMiddle = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body', disabled: true },
  { value: 'c', title: 'C tab', body: 'C body' },
];

describe('Tabs disabled navigation', () => {
  test('horizontal: ArrowRight skips a disabled middle tab', async () => {
    const { container } = render(Wrapper, { value: 'a', items: withDisabledMiddle });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    // Roving tabindex tracks the new selection.
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('0');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('horizontal: ArrowLeft skips a disabled middle tab', async () => {
    const { container } = render(Wrapper, { value: 'c', items: withDisabledMiddle });
    const cTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[2],
      HTMLElement,
    );
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'ArrowLeft' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');
  });

  test('vertical: ArrowDown skips a disabled middle tab', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      orientation: 'vertical',
      activateOnFocus: true,
      items: withDisabledMiddle,
    });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowDown' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');
  });

  test('vertical: ArrowUp skips a disabled middle tab', async () => {
    const { container } = render(Wrapper, {
      value: 'c',
      orientation: 'vertical',
      activateOnFocus: true,
      items: withDisabledMiddle,
    });
    const cTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[2],
      HTMLElement,
    );
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'ArrowUp' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('Home skips a disabled leading tab to land on the first enabled', async () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'c', items: navigationItems });
    const cTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[2],
      HTMLElement,
    );
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'Home' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('End skips a disabled trailing tab to land on the last enabled', async () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items: navigationItems });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'End' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('ArrowRight wraps past a disabled boundary tab', async () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'b', items: navigationItems });
    const bTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[1],
      HTMLElement,
    );
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'ArrowRight' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('vertical: ArrowDown wraps past a disabled boundary tab', async () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, {
      value: 'b',
      orientation: 'vertical',
      activateOnFocus: true,
      items: navigationItems,
    });
    const bTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[1],
      HTMLElement,
    );
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'ArrowDown' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });
});
