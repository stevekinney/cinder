/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');
const { default: TrailingWrapper } =
  await import('../../test/fixtures/tabs-trailing-fixture.svelte');
const { default: SiblingWrapper } = await import('../../test/fixtures/tabs-sibling-fixture.svelte');

const tabsCss = readFileSync(new URL('./tabs.css', import.meta.url), 'utf8');

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

describe('Tabs responsive CSS', () => {
  test('vertical tab layout collapses through a component container query', () => {
    expect(tabsCss).toContain('container-name: cinder-tabs;');
    expect(tabsCss).toContain('@container cinder-tabs (max-width: 30rem)');
    expect(tabsCss).not.toContain('@media (max-width: 30rem)');
    expect(tabsCss).toMatch(
      /@container cinder-tabs \(max-width: 30rem\)[\s\S]*?\.cinder-tabs\[data-cinder-orientation='vertical'\][\s\S]*?flex-direction:\s*column;/,
    );
  });

  test('fill mode exposes the flex contract needed for bounded pane layouts', () => {
    const { container } = render(Wrapper, { value: 'a', fill: true, items });
    const root = container.querySelector('.cinder-tabs');
    const panel = container.querySelector('[role="tabpanel"]');

    expect(root?.hasAttribute('data-cinder-fill')).toBe(true);
    expect(panel).not.toBeNull();
    expect(tabsCss).toMatch(
      /\.cinder-tabs\[data-cinder-fill\]\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-block-size:\s*0;/,
    );
    expect(tabsCss).toMatch(/\.cinder-tab-panel\s*\{[^}]*flex:\s*1 1 auto;/);
    expect(tabsCss).toMatch(/\.cinder-tab-panel\s*\{[^}]*min-block-size:\s*0;/);
  });
});

describe('Tabs font-weight layout stability (regression #402)', () => {
  // The fix for #402 moved font-weight from [data-cinder-active] to the base
  // .cinder-tab rule so that activating a sibling does not toggle a tab's weight
  // and cause layout shift / offsetWidth change in neighbouring tabs.

  test('base .cinder-tab rule carries font-weight (weight is always applied)', () => {
    // The base rule must set font-weight so the weight never changes on activation.
    expect(tabsCss).toMatch(/\.cinder-tab\s*\{[^}]*font-weight\s*:/);
  });

  test('[data-cinder-active] rule does NOT set font-weight (no weight toggle)', () => {
    // Extracting just the [data-cinder-active] block and asserting font-weight is absent
    // prevents the sibling-jank regression: an inactive tab's offsetWidth must not
    // change when a sibling activates.
    const activeBlockMatch = tabsCss.match(/\.cinder-tab\[data-cinder-active\]\s*\{([^}]*)\}/);
    // The selector must exist (active state is styled).
    expect(activeBlockMatch).not.toBeNull();
    // The block must NOT contain font-weight.
    const activeBlock = activeBlockMatch![1];
    expect(activeBlock).not.toContain('font-weight');
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
  const itemsWithDisabledMiddle = [
    { value: 'design', title: 'Design', body: 'Design body' },
    { value: 'ship', title: 'Ship', body: 'Ship body', disabled: true },
    { value: 'review', title: 'Review', body: 'Review body' },
  ];

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

    const designTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    designTab.focus();
    await fireEvent.keyDown(designTab, { key: 'ArrowRight' });

    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('Ship body');
  });
});

describe('Tabs keyboard navigation skips disabled tabs', () => {
  const withDisabledMiddle = [
    { value: 'a', title: 'A tab', body: 'A body' },
    { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    { value: 'c', title: 'C tab', body: 'C body' },
  ];

  test('horizontal: ArrowRight skips a disabled middle tab', async () => {
    const { container } = render(Wrapper, { value: 'a', items: withDisabledMiddle });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    const cTab = Array.from(container.querySelectorAll('[role="tab"]'))[2] as HTMLElement;
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
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    const cTab = Array.from(container.querySelectorAll('[role="tab"]'))[2] as HTMLElement;
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'ArrowUp' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('Home skips a disabled leading tab to land on the first enabled', async () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'c', items });
    const cTab = Array.from(container.querySelectorAll('[role="tab"]'))[2] as HTMLElement;
    cTab.focus();
    await fireEvent.keyDown(cTab, { key: 'Home' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('End skips a disabled trailing tab to land on the last enabled', async () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'End' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('ArrowRight wraps past a disabled boundary tab', async () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'b', items });
    const bTab = Array.from(container.querySelectorAll('[role="tab"]'))[1] as HTMLElement;
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'ArrowRight' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('vertical: ArrowDown wraps past a disabled boundary tab', async () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body' },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, {
      value: 'b',
      orientation: 'vertical',
      activateOnFocus: true,
      items,
    });
    const bTab = Array.from(container.querySelectorAll('[role="tab"]'))[1] as HTMLElement;
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'ArrowDown' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('all-disabled-except-one: arrow keys stay on the only enabled tab', async () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'b', items });
    const bTab = Array.from(container.querySelectorAll('[role="tab"]'))[1] as HTMLElement;
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'ArrowRight' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(bTab, { key: 'ArrowLeft' });
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  test('horizontal: orientation-irrelevant ArrowUp/Down do not preventDefault', async () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      aTab.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  test('all-disabled: arrow keys are a no-op and call preventDefault', async () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items });
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    const aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
    aTab.focus();
    await fireEvent.keyDown(aTab, { key: 'ArrowDown' });
    // Focus moved past the disabled middle tab to C, but selection stays on A.
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('false');
    const cTab = tabs[2] as HTMLElement;
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
    let aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    aTab = Array.from(container.querySelectorAll('[role="tab"]'))[0] as HTMLElement;
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
    const bTab = Array.from(container.querySelectorAll('[role="tab"]'))[1] as HTMLElement;
    bTab.focus();
    await fireEvent.keyDown(bTab, { key: 'Enter' });
    await fireEvent.keyDown(bTab, { key: ' ' });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
  });
});

describe('Tabs roving tabindex with disabled tabs', () => {
  test('selected-disabled at mount: first enabled tab gets tabindex="0"', () => {
    const items = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body' },
      { value: 'c', title: 'C tab', body: 'C body' },
    ];
    const { container } = render(Wrapper, { value: 'a', items });
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
    const items = [
      { value: 'a', title: 'A tab', body: 'A body', disabled: true },
      { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    ];
    const { container } = render(Wrapper, { value: 'a', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('Tab data-variant reflects tabs orientation', () => {
  test('horizontal Tabs render each Tab with data-variant="horizontal"', () => {
    const { container } = render(Wrapper, { value: 'a', orientation: 'horizontal', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    for (const tab of tabs) {
      expect(tab.getAttribute('data-variant')).toBe('horizontal');
    }
  });

  test('vertical Tabs render each Tab with data-variant="vertical"', () => {
    const { container } = render(Wrapper, { value: 'a', orientation: 'vertical', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    for (const tab of tabs) {
      expect(tab.getAttribute('data-variant')).toBe('vertical');
    }
  });
});

describe('Tabs sibling id isolation', () => {
  test('two Tabs sharing a value produce distinct panel ids and tab ids', () => {
    // Regression for: tab/panel ids were derived from value alone (e.g.
    // `cinder-tab-panel-overview`) which collided across sibling Tabs instances,
    // causing aria-controls to resolve to the first matching element in tree
    // order rather than the panel in the same Tabs instance.
    const { container } = render(SiblingWrapper, { sharedValue: 'overview' });

    // Collect all tab buttons and panels that carry the shared value.
    const allTabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const allPanels = Array.from(container.querySelectorAll('[role="tabpanel"]'));

    // Both Tabs instances are active on the shared value, so both panels are
    // rendered. There must be exactly two panels visible.
    expect(allPanels.length).toBe(2);

    // Collect every id present in the document — ids must be unique.
    const tabIds = allTabs.map((tab) => tab.getAttribute('id')).filter(Boolean) as string[];
    const panelIds = allPanels.map((panel) => panel.getAttribute('id')).filter(Boolean) as string[];

    // No duplicate ids anywhere in the document.
    expect(new Set(tabIds).size).toBe(tabIds.length);
    expect(new Set(panelIds).size).toBe(panelIds.length);

    // Each Tab's aria-controls must point to the panel in ITS OWN Tabs instance.
    // Find the two "overview" tab buttons (one per Tabs instance).
    const overviewTabs = allTabs.filter(
      (tab) => tab.getAttribute('data-cinder-value') === 'overview',
    );
    expect(overviewTabs.length).toBe(2);

    for (const overviewTab of overviewTabs) {
      const ariaControls = overviewTab.getAttribute('aria-controls');
      expect(ariaControls).not.toBeNull();

      // The panel pointed at by aria-controls must exist exactly once in the DOM.
      const targetPanels = container.querySelectorAll(`#${CSS.escape(ariaControls!)}`);
      expect(targetPanels.length).toBe(1);

      // That panel must be inside the same Tabs root as the tab button itself.
      const tabsRoot = overviewTab.closest('.cinder-tabs');
      expect(tabsRoot).not.toBeNull();
      expect(tabsRoot!.contains(targetPanels[0]!)).toBe(true);
    }
  });

  test('aria-labelledby on each panel points back to its own tab (cross-instance safety)', () => {
    const { container } = render(SiblingWrapper, { sharedValue: 'overview' });

    const allPanels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
    expect(allPanels.length).toBe(2);

    for (const panel of allPanels) {
      const labelledBy = panel.getAttribute('aria-labelledby');
      expect(labelledBy).not.toBeNull();

      // The tab referenced by aria-labelledby must exist exactly once.
      const referencedTabs = container.querySelectorAll(`#${CSS.escape(labelledBy!)}`);
      expect(referencedTabs.length).toBe(1);

      // The referenced tab must live in the same Tabs root as the panel.
      const tabsRoot = panel.closest('.cinder-tabs');
      expect(tabsRoot).not.toBeNull();
      expect(tabsRoot!.contains(referencedTabs[0]!)).toBe(true);
    }
  });
});
