/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  installFakeResizeObserver,
  makeItems,
  renderedRows,
  reportRowSizes,
  restoreResizeObserver,
  rowSnippet,
} from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — paging and key repeat past a sticky header', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  test('keeps correcting a dynamic destination through an off-axis arrow', async () => {
    // An off-axis arrow scrolls nothing here, so it must not retire the settle loop.
    // Under dynamicSize that loop is what re-derives the destination once the rows the
    // jump landed among are measured; retired early, the scroll stops on the estimate
    // it first computed and never comes back for the correction.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    // End against all-estimates: 100 rows at 20px is 2000, less a 200px viewport.
    const pressed = fireEvent.keyDown(list, { key: 'End' });
    // Lands inside the settle loop's pending frames, which is where retiring it bites.
    await fireEvent.keyDown(list, { key: 'ArrowRight' });
    // A row turns out to be 120px rather than 20px, so the end of the list is 100px
    // further on than the first write assumed.
    reportRowSizes(new Map([[95, 120]]));
    await pressed;
    await tick();

    await waitFor(() => expect(list.scrollTop).toBe(1_900));

    restoreResizeObserver();
  });
});
