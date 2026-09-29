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

describe('Tabs activation', () => {
  test('clicking a tab activates it and reveals its panel', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const bTab = tabs[1];
    expect(bTab).toBeDefined();
    await fireEvent.click(requiredInstance(bTab, Element));
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
    await fireEvent.click(requiredInstance(dTab, Element));
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');
  });
});

describe('Tabs keyboard navigation', () => {
  const itemsWithDisabledMiddle = [
    { value: 'design', title: 'Design', body: 'Design body' },
    { value: 'ship', title: 'Ship', body: 'Ship body', disabled: true },
    { value: 'review', title: 'Review', body: 'Review body' },
  ];

  test('horizontal: ArrowRight moves to next tab and activates (default)', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });

  test('horizontal: ArrowLeft from first wraps to last', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowLeft' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('Home jumps to the first tab', async () => {
    const { container } = render(Wrapper, { value: 'c', items });
    const cTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[2],
      HTMLElement,
    );
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'Home' });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');
  });

  test('End jumps to the last tab', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
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
    const aTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowDown' });
    // Manual activation: panel still A until Enter.
    let panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('A body');

    // Focus has moved to B; press Enter to activate.
    const bTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[1],
      HTMLElement,
    );
    await fireEvent.keyDown(bTab, { key: 'Enter' });
    panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });

  test('horizontal navigation skips disabled tabs', async () => {
    const { container } = render(Wrapper, {
      value: 'design',
      items: itemsWithDisabledMiddle,
    });

    const tabButtons = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const designTab = tabButtons[0]!;
    const shipTab = tabButtons[1]!;
    const reviewTab = tabButtons[2]!;

    designTab.focus();
    await fireEvent.keyDown(designTab, { key: 'ArrowRight' });

    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('Review body');
    expect(document.activeElement).toBe(reviewTab);
    expect(document.activeElement).not.toBe(shipTab);
  });

  test('Home and End skip disabled endpoint tabs', async () => {
    const { container } = render(Wrapper, {
      value: 'review',
      items: [
        {
          value: 'disabled-start',
          title: 'Disabled start',
          body: 'Disabled start body',
          disabled: true,
        },
        { value: 'design', title: 'Design', body: 'Design body' },
        { value: 'review', title: 'Review', body: 'Review body' },
        { value: 'disabled-end', title: 'Disabled end', body: 'Disabled end body', disabled: true },
      ],
    });

    const tabButtons = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const reviewTab = tabButtons[2]!;
    const designTab = tabButtons[1]!;

    reviewTab.focus();
    await fireEvent.keyDown(reviewTab, { key: 'Home' });
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain('Design body');

    designTab.focus();
    await fireEvent.keyDown(designTab, { key: 'End' });
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain('Review body');
  });

  test('disabled state updates remove tabs from keyboard navigation', async () => {
    const { container, rerender } = render(Wrapper, {
      value: 'design',
      items: [
        { value: 'design', title: 'Design', body: 'Design body' },
        { value: 'review', title: 'Review', body: 'Review body' },
        { value: 'ship', title: 'Ship', body: 'Ship body' },
      ],
    });

    await rerender({
      value: 'design',
      items: [
        { value: 'design', title: 'Design', body: 'Design body' },
        { value: 'review', title: 'Review', body: 'Review body', disabled: true },
        { value: 'ship', title: 'Ship', body: 'Ship body' },
      ],
    });

    const designTab = requiredInstance(
      Array.from(container.querySelectorAll('[role="tab"]'))[0],
      HTMLElement,
    );
    designTab.focus();
    await fireEvent.keyDown(designTab, { key: 'ArrowRight' });

    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('Ship body');
  });
});
