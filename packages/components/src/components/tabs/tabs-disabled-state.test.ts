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

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body' },
  { value: 'c', title: 'C tab', body: 'C body' },
];

const withDisabledMiddle = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body', disabled: true },
  { value: 'c', title: 'C tab', body: 'C body' },
];

describe('Tabs disabled navigation', () => {
  test('all-disabled-except-one: arrow keys stay on the only enabled tab', async () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
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
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(bTab, { key: 'ArrowLeft' });
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('horizontal: orientation-irrelevant ArrowUp/Down do not preventDefault', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      aTab.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  test('all-disabled: arrow keys are a no-op and call preventDefault', async () => {
    const navigationItems = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items: navigationItems });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    // Construct cancelable KeyboardEvents so we can assert `defaultPrevented`
    // after dispatch. happy-dom respects preventDefault on these.
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      aTab.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    // aria-selected remains on `a` (still the bound value); no tab gets tabindex=0.
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
  });

  test('activateOnFocus=true: arrowing past a disabled tab activates the next enabled tab', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      activateOnFocus: true,
      items: withDisabledMiddle,
    });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('activateOnFocus=false: arrowing past a disabled tab moves focus but not selection', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      orientation: 'vertical',
      activateOnFocus: false,
      items: withDisabledMiddle,
    });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowDown' });
    // Focus moved past the disabled middle tab to C, but selection stays on A.
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('false');
    const cTab = requiredInstance(tabs[2], HTMLElement);
    expect(cTab.ownerDocument.activeElement).toBe(cTab);
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');
    // Enter on the focused enabled tab activates it.
    await fireEvent.keyDown(cTab, { key: 'Enter' });
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain('C body');
  });

  test('dynamic disable: toggling a tab to disabled makes arrows skip it', async () => {
    const initialItems = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body', disabled: false },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container, rerender } = render(Wrapper, { value: 'a', items: initialItems });

    // Initially, ArrowRight from A lands on B.
    let aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    let tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');

    // Toggle B to disabled; ArrowRight from A should now skip B to C.
    await rerender({
      value: 'a',
      items: [
        { value: 'a', title: 'A tab', body: 'A body' },
        { value: 'b', title: 'B tab', body: 'B body', disabled: true },
        { value: 'c', title: 'C tab', body: 'C body' },
      ],
    });
    aTab = requiredInstance(Array.from(container.querySelectorAll('[role="tab"]'))[0], HTMLElement);
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');

    // Toggle B back to enabled; ArrowRight from A lands on B again.
    await rerender({
      value: 'a',
      items: [
        { value: 'a', title: 'A tab', body: 'A body' },
        { value: 'b', title: 'B tab', body: 'B body', disabled: false },
        { value: 'c', title: 'C tab', body: 'C body' },
      ],
    });
    aTab = requiredInstance(Array.from(container.querySelectorAll('[role="tab"]'))[0], HTMLElement);
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('Enter targeting a disabled tab does not change selection', async () => {
    // Real browsers will not focus a native-disabled button, so this is an
    // observable-output check, not a focus-handling drill. We dispatch Enter
    // synthetically against the disabled tab's element to verify that under
    // any synthetic path (manual dispatch, test harness, etc.), selection
    // never lands on a disabled tab.
    const { container } = render(Wrapper, { value: 'a', items: withDisabledMiddle });
    const bTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[1],
      HTMLElement,
    );
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'Enter' });
    await fireEvent.keyDown(bTab, { key: ' ' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
  });
});
