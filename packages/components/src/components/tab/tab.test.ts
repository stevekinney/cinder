/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');
const { default: Tab } = await import('./tab.svelte');

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body', disabled: true },
];

describe('Tab', () => {
  test('throws when rendered outside a Tabs component', () => {
    expect(() =>
      render(Tab, {
        props: {
          value: 'lonely',
          children: createRawSnippet(() => ({
            render: () => '<span>Lonely</span>',
            setup: () => {},
          })),
        },
      }),
    ).toThrow(/must be used inside a Tabs component/);
  });

  test('each Tab carries role="tab" and a stable id', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.id).toBe('cinder-tab-a');
    expect(tabs[1]?.id).toBe('cinder-tab-b');
  });

  test('aria-selected and roving tabindex respond to the active value', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
  });

  test('disabled Tab reflects its disabled prop without erroring', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const disabledTab = container.querySelectorAll('[role="tab"]')[1];
    expect(disabledTab?.hasAttribute('disabled')).toBe(true);
  });

  test('aria-controls points at the matching panel id', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    const tab = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(tab?.getAttribute('aria-controls')).toBe('cinder-tab-panel-a');
  });
});
