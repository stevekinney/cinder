/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body' },
  { value: 'c', title: 'C tab', body: 'C body' },
];

describe('Tabs ARIA structure', () => {
  test('TabList carries role="tablist" and orientation', () => {
    const { container } = render(Wrapper, {
      value: 'a',
      orientation: 'horizontal',
      items,
    });
    const list = container.querySelector('[role="tablist"]');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('aria-orientation')).toBe('horizontal');
  });

  test('each Tab carries role="tab" and aria-selected reflects active state', () => {
    const { container } = render(Wrapper, { value: 'b', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.length).toBe(3);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('false');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('false');
  });

  test('only the active tab is in the tab order (roving tabindex)', () => {
    const { container } = render(Wrapper, { value: 'b', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
  });

  test('only the active TabPanel is rendered', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const panels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
    expect(panels.length).toBe(1);
    expect(panels[0]?.textContent).toContain('A body');
  });

  test('TabPanel aria-labelledby points at the matching Tab id', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tab = container.querySelector('[role="tab"][aria-selected="true"]');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe(tab?.getAttribute('id'));
  });
});

describe('Tabs activation', () => {
  test('clicking a tab activates it and reveals its panel', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const bTab = tabs[1];
    expect(bTab).toBeDefined();
    await fireEvent.click(bTab as Element);
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });

  test('disabled tab does not activate on click', async () => {
    const itemsWithDisabled = [
      ...items,
      { value: 'd', title: 'D tab', body: 'D body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items: itemsWithDisabled });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const dTab = tabs[3];
    expect(dTab).toBeDefined();
    await fireEvent.click(dTab as Element);
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');
  });
});

describe('Tabs keyboard navigation', () => {
  test('horizontal: ArrowRight moves to next tab and activates (default)', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });

  test('horizontal: ArrowLeft from first wraps to last', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowLeft' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('Home jumps to the first tab', async () => {
    const { container } = render(Wrapper, { value: 'c', items });
    const cTab = Array.from(container.querySelectorAll('[role="tab"]'))[2] as HTMLElement;
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'Home' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');
  });

  test('End jumps to the last tab', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'End' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('vertical: arrow up/down navigate; activateOnFocus=false requires Enter', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      orientation: 'vertical',
      activateOnFocus: false,
      items,
    });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowDown' });
    // Manual activation: panel still A until Enter.
    let panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');

    // Focus has moved to B; press Enter to activate.
    const bTab = Array.from(container.querySelectorAll('[role="tab"]'))[1] as HTMLElement;
    await fireEvent.keyDown(bTab, { key: 'Enter' });
    panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });
});
