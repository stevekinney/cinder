/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — edge callbacks under adaptive overscan', () => {
  // The invariant this used to pin structurally — that the visible range comes from
  // scroll geometry rather than from undoing the window's overscan, and that the
  // edge-proximity trigger distance stays the CONFIGURED overscan rather than the
  // effective one — is now exercised behaviourally in a real browser, where events
  // carry real timestamps and adaptive overscan actually engages. See
  // `scripts/browser-fixtures/tests/virtual-list.playwright.ts`'s adaptive-overscan
  // suite (COR-376), which scrolls fast enough to raise the effective overscan and
  // asserts `onEndReached` still fires within the CONFIGURED overscan of the end.

  test('still fires both callbacks with an overscan wider than the list', async () => {
    // The clamping case, exercised by configuration rather than by velocity: with an
    // overscan half the collection, the window is pinned to both edges at once, so
    // every index the window could offer is clamped and only the geometry still
    // describes what the reader can see.
    let startReached = 0;
    let endReached = 0;
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      overscan: 50,
      onStartReached: () => {
        startReached += 1;
      },
      onEndReached: () => {
        endReached += 1;
      },
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    await waitFor(() => expect(startReached).toBe(1));

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 1_800;
    await fireEvent.scroll(list);
    await tick();

    await waitFor(() => expect(endReached).toBe(1));
  });
});
