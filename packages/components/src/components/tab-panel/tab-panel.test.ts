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
      /must be used inside a Tabs component/,
    );
  });

  test('only the active panel renders and carries role="tabpanel"', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const panels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
    expect(panels).toHaveLength(1);
    expect(panels[0]?.textContent).toContain('A body');
  });

  test('panel id and aria-labelledby derive deterministically from the value', () => {
    const { container } = render(Wrapper, { value: 'b', items });
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.id).toBe('cinder-tab-panel-b');
    expect(panel?.getAttribute('aria-labelledby')).toBe('cinder-tab-b');
  });

  test('the rendered panel id matches the active tab aria-controls', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tab = container.querySelector('[role="tab"][aria-selected="true"]');
    const panel = container.querySelector('[role="tabpanel"]');
    expect(tab?.getAttribute('aria-controls')).toBe(panel?.id);
  });
});
