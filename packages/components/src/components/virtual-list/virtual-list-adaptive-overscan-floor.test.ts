/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — adaptiveOverscan', () => {
  test('never renders fewer rows than the configured overscan', async () => {
    // The floor is the safety property: turning adaptation on must not be able to
    // make pop-in worse than leaving it off.
    const baseline = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 6,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });
    await waitFor(() => expect(renderedRows(baseline.container).length).toBeGreaterThan(0));
    const baselineCount = renderedRows(baseline.container).length;

    const adaptive = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 6,
      adaptiveOverscan: true,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });
    await waitFor(() => expect(renderedRows(adaptive.container).length).toBeGreaterThan(0));

    expect(renderedRows(adaptive.container).length).toBeGreaterThanOrEqual(baselineCount);
  });
});
