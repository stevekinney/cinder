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

describe('VirtualList — paging and key repeat past a sticky header', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  test('keeps a dynamic pinned row measurable rather than freezing its size', async () => {
    // Out of flow the row has no siblings to size against and would collapse to its
    // content, so it needs a floor. A DEFINITE size is the wrong floor: together with
    // the row's own `overflow: hidden` it freezes the observed border box, so a header
    // whose content arrives while it is pinned can never be remeasured — it stays
    // clipped, and the obstruction every keyboard offset is measured against stays
    // stale, until the row happens to re-enter the rendered window.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-sticky-pinned="true"]')).not.toBeNull(),
    );

    const pinned = container.querySelector<HTMLElement>('[data-cinder-sticky-pinned="true"]');
    // Neither bound. A definite size froze the observed border box so growth could
    // never be seen; a minimum froze shrinkage instead, holding empty space and
    // reporting the larger obstruction to every keyboard destination. Both came from
    // special-casing this row — every other dynamic row is left unsized so it can be
    // measured, and out of flow this one is sized by its own content, which is the
    // intrinsic extent the observer exists to read.
    expect(pinned?.style.blockSize).toBe('');
    expect(pinned?.style.minBlockSize).toBe('');
    expect(pinned?.style.maxBlockSize).toBe('');
    // But it is still positioned, which is the part that keeps it out of flow.
    expect(pinned?.style.insetBlockStart).not.toBe('');

    restoreResizeObserver();
  });

  test('a horizontal page key retires the settle loop it interrupts', async () => {
    // Only horizontal reaches this. The Page keys are in the block-axis scroll set, so
    // a vertical list retires the loop on the way in; the inline set leaves them out,
    // because a horizontal container is not what the browser pages with — but this
    // component claims them in either orientation. A loop left running writes its own
    // destination back once measurements settle and undoes the page.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      horizontal: true,
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Columns',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    // Somewhere with room to move in either direction.
    list.scrollLeft = 2_000;
    await fireEvent.scroll(list);
    await tick();

    // Home starts a settle pass back toward the start, which writes 0 at once and then
    // keeps re-deriving that destination as rows are measured.
    const pressed = fireEvent.keyDown(list, { key: 'Home' });
    // PageDown lands inside its pending frames and claims the scroll for itself.
    await fireEvent.keyDown(list, { key: 'PageDown' });
    // A measurement the interrupted loop would have re-targeted against.
    reportRowSizes(new Map([[150, 120]]));
    await pressed;
    await tick();

    // One page on from where Home left the reader — 200px of viewport less the 20px
    // header — rather than snapped back to 0 by the loop it interrupted.
    await waitFor(() => expect(Math.round(list.scrollLeft)).toBe(180));

    restoreResizeObserver();

    // And the retire itself, structurally, because the assertion above does not
    // discriminate: happy-dom's frame scheduling lets the interrupted loop exit before
    // the page key lands, so it passes with or without the call. Only a real smooth
    // animation keeps the loop alive long enough to write its destination back. The
    // mechanism is covered behaviourally elsewhere — see the off-axis arrow test — so
    // what is worth pinning here is that this branch uses it.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();
    const pageBranch = source.slice(
      source.indexOf("if (event.key === 'PageDown' || event.key === 'PageUp') {"),
      source.indexOf('const target = resolveKeyboardTargetIndex({'),
    );
    expect(pageBranch).toContain('handleReaderTakeover();');
    const takeover = source.slice(
      source.indexOf('function handleReaderTakeover('),
      source.indexOf('function handleWheel('),
    );
    expect(takeover).toContain('retireSettleLoop();');
  });

  test('pages against the header waiting at the destination, not the one here', async () => {
    // Consecutive headers need not be the same size once they are measured. Stepping by
    // the CURRENT header's uncovered viewport hides the difference: crossing into a
    // section whose header is taller leaves the band between the two heights covered on
    // arrival, and it is never read — it was below the fold before the press and behind
    // the header after it.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      dynamicSize: true,
      stickyItems: [0, 20],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    // Row 20 has to be MOUNTED before it can be measured — the observer only sees rows
    // in the window, so reporting a size for one outside it does nothing at all.
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();
    // Header 0 is 20px; header 20, the next section's, is 100px.
    reportRowSizes(new Map([[20, 100]]));
    await tick();

    const scrollTop = instrumentScrollTop(list);

    // Rows are 20px and row 20 is 100px, so row 20 starts at 400 and the section after
    // it at 500. Parked at 220 the viewport ends at 420, just inside that section.
    list.scrollTop = 220;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'PageDown' });
    await tick();

    // The destination's header is the 100px one, so the visible bottom of 420 has to
    // land 100px below the new top rather than 20px: 420 - 100.
    await waitFor(() => expect(scrollTop.value()).toBe(320));

    // And nothing was skipped — content at the old visible bottom is now exactly at the
    // new uncovered top.
    expect(scrollTop.value() + 100).toBe(420);

    restoreResizeObserver();
  });

  test('returns to where it started when a page down is paged back up', async () => {
    // The property both asymmetry reports were really asking for, and the reason paging
    // moved to pixels: an index-based step has to guess a row count, and the guess that
    // is right going forward is wrong coming back. A pixel move of the uncovered
    // viewport is reversible by construction.
    //
    // Deliberately started off a row boundary, which is where every index-based version
    // of this went wrong — the partly visible trailing row going down, and the partly
    // covered leading row coming back up.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 36,
      height: '360px',
      overscan: 0,
      stickyItems: [0, 25, 50, 75],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const scrollTop = instrumentScrollTop(list);

    for (const start of [1_810, 1_800, 907, 36]) {
      list.scrollTop = start;
      await fireEvent.scroll(list);
      await tick();

      await fireEvent.keyDown(list, { key: 'PageDown' });
      await tick();

      // The distance itself, not only that it came back. A round trip alone would pass
      // for any symmetric-but-wrong step — the viewport including the header, say — so
      // both halves are pinned: 360px of viewport less the 36px header is 324.
      expect(scrollTop.value()).toBe(start + 324);

      await fireEvent.scroll(list);
      await tick();
      await fireEvent.keyDown(list, { key: 'PageUp' });
      await tick();

      expect(scrollTop.value()).toBe(start);
    }
  });

  test('pages by measured rows, not by the itemHeight estimate', async () => {
    // Under dynamicSize `itemHeight` is only the initial guess. Converting the viewport
    // into rows with it paged nine indexes where one was due — 100px rows against a
    // 20px estimate — stepping over every row in between. The settle loop cannot undo
    // that: it corrects the destination's pixels, not which row was asked for.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    // A 20px header over content rows that really measure 100px.
    const measured = new Map<number, number>([[0, 20]]);
    for (let index = 1; index < 500; index += 1) measured.set(index, 100);
    reportRowSizes(measured);
    await tick();

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const scrollTop = instrumentScrollTop(list);

    // Row 1 starts at 20 and the header covers through 40, so row 1 is the first
    // uncovered one and rows 1 and 2 are what the 200px viewport exposes.
    list.scrollTop = 20;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'PageDown' });
    await tick();

    // Two rows on, not nine: row 3 starts at 220 and clears the header at 200.
    await waitFor(() => expect(scrollTop.value()).toBe(200));

    restoreResizeObserver();
  });

  test('pages by the rows the header leaves visible, not by the whole viewport', async () => {
    // A 200px viewport over 20px rows fits ten, but a 20px header covers one of them,
    // so only nine are exposed. Paging by ten steps over the row under the header:
    // covered before the press and covered after it, so it is never read.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const scrollTop = instrumentScrollTop(list);

    // start(200) === 4000, with header 0 pinned over the leading edge.
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await tick();

    await fireEvent.keyDown(list, { key: 'PageDown' });
    await tick();

    // Row 201 is the first uncovered one, so a nine-row page reaches 210 — which is
    // exactly the row a ten-row page would have jumped over. It lands below the
    // header: start(210) - 20.
    expect(scrollTop.value()).toBe(4_180);
  });
});
