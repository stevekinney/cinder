/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  installFakeResizeObserver,
  instrumentScrollTop,
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

describe('VirtualList — keyboard navigation past a sticky header', () => {
  afterEach(() => {
    restoreResizeObserver();
    cleanup();
    document.body.replaceChildren();
  });

  test('counts a measured header that is still inside the rendered window', async () => {
    // The P1 case. `pinnedStickyIndex` is null while the header is still mounted in
    // the overscanned window, but CSS has been holding it over the leading edge that
    // whole time. Measuring the obstruction from the pinned row alone reported it as
    // zero here, so ArrowDown advanced to the row directly beneath a 100px header —
    // five 20px rows the reader cannot see.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    // Row 0 is really a 100px header. Rows are 20px, so offsets run
    // [0, 100, 120, 140, 160, 180, ...].
    reportRowSizes(new Map([[0, 100]]));
    await tick();

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const scrollTop = instrumentScrollTop(list);
    list.scrollTop = 50;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'ArrowDown' });
    await tick();

    // Partway into the header, the first row it is NOT covering starts at 150, which
    // is row 3. ArrowDown therefore goes to row 4, at offset 160 — and lands it just
    // below the header rather than under it: 160 - 100.
    expect(scrollTop.value()).toBe(60);
  });

  test('moves in both directions when parked exactly where a header starts', async () => {
    // Every step onto or off a section lands at precisely start(header), so this is
    // the offset the list sits at most often. It is also where the two obstruction
    // rules disagree: the header is simultaneously the first visible row and the
    // thing covering the leading edge, and whichever way that is resolved, one of
    // the two directions stops moving unless stepping passes over sticky rows.
    // A render each, rather than one list rewound between the two presses. Setting
    // the offset back to where a keypress started is indistinguishable from that
    // press not having moved yet, which is a state only the test can produce.
    async function pressFromHeaderStart(key: string): Promise<number> {
      const { container } = render(VirtualList, {
        items: makeItems(1_000),
        itemHeight: 20,
        height: '200px',
        overscan: 0,
        stickyItems: [0, 10],
        row: rowSnippet(),
        'aria-label': 'Feed',
      });

      await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
      const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
      const scrollTop = instrumentScrollTop(list);

      // start(10) === 200, with header 10 held at the leading edge.
      list.scrollTop = 200;
      await fireEvent.scroll(list);
      await tick();

      await fireEvent.keyDown(list, { key });
      await tick();
      return scrollTop.value();
    }

    // Down: row 11 is uncovered, so the step goes to 12 and clears header 10.
    expect(await pressFromHeaderStart('ArrowDown')).toBe(220);

    // Up: the step from 11 reaches 10, which IS the header — its own inset is zero,
    // so the target resolves to 200 and the key does nothing. Passing over it reaches
    // row 9, cleared of header 0.
    expect(await pressFromHeaderStart('ArrowUp')).toBe(160);
  });

  test('re-derives a keyboard destination as the rows it jumps into are measured', async () => {
    // The P2 case. An earlier version wrote the offset directly whenever a header was
    // pinned, which skipped the settle loop: under dynamicSize an End jump lands on
    // estimates, and the measurements that arrive afterwards move the target out from
    // under it.
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
    reportRowSizes(new Map([[0, 100]]));
    await tick();

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 50;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'End' });
    await tick();

    // Total is 100 rows: row 0 at 100px and 99 at 20px, so 2080 against a 200px
    // viewport. End settles at the bottom rather than at a stale estimate's idea of it.
    await waitFor(() => expect(list.scrollTop).toBe(1_880));
  });
});
