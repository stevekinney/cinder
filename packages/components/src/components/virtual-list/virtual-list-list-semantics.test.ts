/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — list semantics', () => {
  test('announces each row as 1-based within the FULL collection, not the window', async () => {
    // The whole reason these attributes are needed on a virtualized list: without
    // them assistive technology announces the rendered window, so a 10,000-row list
    // reads as "3 of 12".
    const { container } = render(VirtualList, {
      items: makeItems(10_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const firstRow = requiredInstance(
      container.querySelector('[data-cinder-virtual-index="0"]'),
      HTMLElement,
    );
    expect(firstRow.getAttribute('aria-posinset')).toBe('1');
    expect(firstRow.getAttribute('aria-setsize')).toBe('10000');
    expect(renderedRows(container).length).toBeLessThan(100);
  });
});
