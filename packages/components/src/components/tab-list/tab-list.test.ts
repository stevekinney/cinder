/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');
const { default: TabList } = await import('./tab-list.svelte');

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body' },
];

describe('TabList', () => {
  test('throws when rendered outside a Tabs component', () => {
    expect(() =>
      render(TabList, {
        props: {
          children: createRawSnippet(() => ({ render: () => '<span></span>', setup: () => {} })),
        },
      }),
    ).toThrow();
  });

  test('root carries role="tablist"', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
  });

  test('aria-orientation reflects the Tabs orientation prop', () => {
    const horizontal = render(Wrapper, { value: 'a', orientation: 'horizontal', items });
    expect(
      horizontal.container.querySelector('[role="tablist"]')?.getAttribute('aria-orientation'),
    ).toBe('horizontal');

    const vertical = render(Wrapper, { value: 'a', orientation: 'vertical', items });
    expect(
      vertical.container.querySelector('[role="tablist"]')?.getAttribute('aria-orientation'),
    ).toBe('vertical');
  });

  test('aria-label is wired from the label prop', () => {
    const { container } = render(Wrapper, { value: 'a', items });
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(
      'Test tabs',
    );
  });
});
