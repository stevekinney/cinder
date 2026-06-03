/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');
const { default: TabPanel } = await import('./tab-panel.svelte');

const emptySnippet = createRawSnippet(() => ({ render: () => '<span></span>', setup: () => {} }));

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body' },
];

describe('TabPanel', () => {
  test('throws when rendered outside a Tabs component', () => {
    expect(() => render(TabPanel, { props: { value: 'lonely', children: emptySnippet } })).toThrow(
      /missing_context/,
    );
  });

  test('only the active panel renders and carries role="tabpanel"', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const panels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
    expect(panels).toHaveLength(1);
    expect(panels[0]?.textContent).toContain('A body');
  });

  test('panel id and aria-labelledby derive from the instance baseId and the value', () => {
    const { container } = render(Wrapper, { value: 'b', items });
    const panel = container.querySelector('[role="tabpanel"]');
    // Ids are namespaced by the root Tabs instance's $props.id() baseId so that
    // sibling Tabs sharing a value do not collide; the value-suffix is stable
    // and the panel's labelledby points back at the matching tab in the same
    // instance (same baseId prefix).
    expect(panel?.id).toMatch(/-panel-b$/);
    expect(panel?.getAttribute('aria-labelledby')).toMatch(/-tab-b$/);
    const panelBase = panel?.id.replace(/-panel-b$/, '');
    const labelBase = panel?.getAttribute('aria-labelledby')?.replace(/-tab-b$/, '');
    expect(panelBase).toBe(labelBase);
    expect(panelBase).toBeTruthy();
  });

  test('the rendered panel id matches the active tab aria-controls', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tab = container.querySelector('[role="tab"][aria-selected="true"]');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(tab?.getAttribute('aria-controls')).toBe(panel?.id);
  });
});
