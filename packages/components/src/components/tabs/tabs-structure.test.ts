/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');
const { default: ExternalPanelWrapper } =
  await import('../../test/fixtures/tabs-external-panel-fixture.svelte');
const { default: TrailingWrapper } =
  await import('../../test/fixtures/tabs-trailing-fixture.svelte');
const { default: SiblingWrapper } = await import('../../test/fixtures/tabs-sibling-fixture.svelte');

const tabsCss = readFileSync(new URL('./tabs.css', import.meta.url), 'utf8');

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body' },
  { value: 'c', title: 'C tab', body: 'C body' },
];

function getAccessibleName(element: Element): string {
  let text = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node.nodeType === node.ELEMENT_NODE) {
      const child = requiredInstance(node, Element);
      if (child.getAttribute('aria-hidden') === 'true') continue;
      text += getAccessibleName(child);
    }
  }
  return text;
}

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

  test('tabs can control a caller-owned panel id', async () => {
    const itemsWithIds = items.map((item) => ({ ...item, id: `editor-tab-${item.value}` }));
    const { container } = render(ExternalPanelWrapper, {
      value: 'a',
      panelId: 'editor-panel',
      items: itemsWithIds,
    });

    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    let panel = container.querySelector('[role="tabpanel"]');

    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.getAttribute('aria-controls'))).toEqual([
      'editor-panel',
      'editor-panel',
      'editor-panel',
    ]);
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
    expect(panel?.textContent).toContain('A body');
    expect(panel?.getAttribute('aria-labelledby')).toBe('editor-tab-a');

    await fireEvent.click(requiredInstance(tabs[1], Element));

    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
    panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('B body');
    expect(panel?.getAttribute('aria-labelledby')).toBe('editor-tab-b');
  });
});

describe('Tabs responsive CSS', () => {
  test('tab buttons stay single-line so the tab list scrolls as one strip', () => {
    expect(tabsCss).toMatch(/\.cinder-tab\s*\{[^}]*flex-shrink:\s*0;/);
    expect(tabsCss).toMatch(/\.cinder-tab\s*\{[^}]*white-space:\s*nowrap;/);
  });

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
    const tab = requiredInstance(
      container.querySelector('[role="tab"][aria-selected="true"]'),
      HTMLElement,
    );
    expect(tab).not.toBeNull();
    // Compute the accessible name by walking children and skipping aria-hidden subtrees.
    // happy-dom does not implement the full AccName algorithm, so do it manually.
    const name = getAccessibleName(tab);
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
    const tabIds = allTabs
      .map((tab) => tab.getAttribute('id'))
      .filter((id): id is string => id !== null);
    const panelIds = allPanels
      .map((panel) => panel.getAttribute('id'))
      .filter((id): id is string => id !== null);

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
