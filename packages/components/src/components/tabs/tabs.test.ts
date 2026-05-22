/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');
const { default: TrailingWrapper } =
  await import('../../test/fixtures/tabs-trailing-fixture.svelte');

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

describe('Tab trailing snippet', () => {
  test('renders the trailing content inside a span with aria-hidden="true"', () => {
    const { container } = render(TrailingWrapper, { value: 'inbox', trailingText: '3' });
    const trailing = container.querySelector('.cinder-tab__trailing');
    expect(trailing).not.toBeNull();
    expect(trailing?.getAttribute('aria-hidden')).toBe('true');
    expect(trailing?.textContent).toContain('3');
  });

  test('accessible name excludes trailing content (aria-hidden subtree is omitted)', () => {
    const { container } = render(TrailingWrapper, { value: 'inbox', trailingText: '3' });
    const tab = container.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
    expect(tab).not.toBeNull();
    // Compute the accessible name by walking children and skipping aria-hidden subtrees.
    // happy-dom does not implement the full AccName algorithm, so do it manually.
    const name = (function getName(element: Element): string {
      let text = '';
      for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === node.TEXT_NODE) {
          text += node.textContent ?? '';
        } else if (node.nodeType === node.ELEMENT_NODE) {
          const child = node as Element;
          if (child.getAttribute('aria-hidden') === 'true') continue;
          text += getName(child);
        }
      }
      return text;
    })(tab);
    expect(name.trim()).toBe('Inbox');
    expect(name).not.toContain('3');
  });

  test('omits the trailing wrapper when no snippet is provided', () => {
    const { container } = render(Wrapper, {
      value: 'a',
      items: [{ value: 'a', title: 'A tab', body: 'A body' }],
    });
    expect(container.querySelector('.cinder-tab__trailing')).toBeNull();
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

describe('Tabs keyboard navigation skips disabled tabs', () => {
  test('ArrowRight skips a disabled tab in the middle', async () => {
    const itemsWithDisabledMiddle = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'a', items: itemsWithDisabledMiddle });
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const aTab = tabs[0]!;
    const cTab = tabs[2]!;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cTab);
    expect(cTab.getAttribute('aria-selected')).toBe('true');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('ArrowLeft skips a disabled tab and wraps', async () => {
    const itemsWithLeadingDisabled = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'b', items: itemsWithLeadingDisabled });
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const bTab = tabs[1]!;
    const cTab = tabs[2]!;
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cTab);
    expect(cTab.getAttribute('aria-selected')).toBe('true');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('C body');
  });

  test('Home skips a leading disabled tab and lands on the first enabled', async () => {
    const itemsWithLeadingDisabled = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'c', items: itemsWithLeadingDisabled });
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const bTab = tabs[1]!;
    const cTab = tabs[2]!;
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'Home' });
    expect(document.activeElement).toBe(bTab);
    expect(bTab.getAttribute('aria-selected')).toBe('true');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });

  test('End skips a trailing disabled tab and lands on the last enabled', async () => {
    const itemsWithTrailingDisabled = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items: itemsWithTrailingDisabled });
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const aTab = tabs[0]!;
    const bTab = tabs[1]!;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'End' });
    expect(document.activeElement).toBe(bTab);
    expect(bTab.getAttribute('aria-selected')).toBe('true');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
  });

  test('controlled value pointing at a disabled tab — navigation anchors from focused tab', async () => {
    // Controlled value=b is disabled. Focus is on the enabled `a`. ArrowRight
    // must move from focused `a` to `c`, never anchoring on disabled `b`.
    const itemsWithDisabledMiddle = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'b', items: itemsWithDisabledMiddle });
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const aTab = tabs[0]!;
    const cTab = tabs[2]!;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cTab);
    expect(cTab.getAttribute('aria-selected')).toBe('true');
  });

  test('Home with a controlled disabled value lands on the first enabled tab', async () => {
    const itemsWithLeadingDisabled = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'a', items: itemsWithLeadingDisabled });
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const bTab = tabs[1]!;
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'Home' });
    expect(document.activeElement).toBe(bTab);
    expect(bTab.getAttribute('aria-selected')).toBe('true');
  });

  test('all-disabled tablist is a no-op on arrow keys', async () => {
    const allDisabled = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items: allDisabled });
    const tablist = container.querySelector('[role="tablist"]') as HTMLElement;
    // No enabled tab can receive focus, so dispatch the event on the tablist
    // container; the handler walks `event.target` and the empty-enabled guard
    // returns early without touching value or focus.
    await fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    const selected = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(selected?.getAttribute('data-cinder-value')).toBe('a');
    // No panel rendered (controlled value points at a disabled tab, which is
    // an a11y violation by the consumer, but the component must not throw).
    // We simply assert no crash and that the selection did not silently move.
  });

  test('runtime disable toggle preserves navigation order (regression)', async () => {
    // Render [a, b, c] enabled; toggle b.disabled true → false; ArrowRight
    // from a must still land on b, not c. This guards against the bug where
    // re-running the registration effect on a disabled change would delete
    // and re-insert b in the parent Map, moving it to the end of the order.
    const allEnabled = items;
    const withBDisabled = [items[0]!, { ...items[1]!, disabled: true }, items[2]!];
    const { container, rerender } = render(Wrapper, { value: 'a', items: allEnabled });
    await rerender({ value: 'a', items: withBDisabled });
    await rerender({ value: 'a', items: allEnabled });

    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const aTab = tabs[0]!;
    const bTab = tabs[1]!;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(bTab);
    expect(bTab.getAttribute('aria-selected')).toBe('true');
  });
});
