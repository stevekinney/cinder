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

describe('VirtualList — dynamicSize', () => {
  afterEach(() => restoreResizeObserver());

  test('keeps the reader on the same row when the itemHeight estimate changes', async () => {
    // An estimate change re-sizes every unmeasured row at once. No ResizeObserver
    // fires — the rows did not change, the estimate did — so nothing queues a
    // correction, and this mode disables native scroll anchoring. Without
    // re-anchoring, the same scrollTop resolves to a different row entirely.
    installFakeResizeObserver();
    const base = {
      items: makeItems(1000),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 20, row: rowSnippet() });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    // At a 20px estimate, offset 10000 puts the reader at index 500.
    list.scrollTop = 10_000;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    // Index 500 now starts at 500 * 40 = 20000. Holding scrollTop would have left
    // the reader at index 250 instead.
    expect(list.scrollTop).toBe(20_000);
  });

  test('re-anchors from the rebuilt table when an estimate change and a measurement land together', async () => {
    // The re-anchor is computed from the table AFTER the rebuild, so it already
    // contains this flush's measurement. Adding the correction delta on top would
    // count it twice; letting the correction overwrite the re-anchor would drop the
    // estimate adjustment. Neither is right — the re-anchor alone is.
    installFakeResizeObserver();
    const base = {
      items: makeItems(100),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 20, row: rowSnippet() });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 400;
    await fireEvent.scroll(list);
    await tick();

    // Row 15 is mounted and sits above the anchor at index 20.
    reportRowSizes(new Map([[15, 60]]));
    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    // Rebuilt table: rows 0-14 and 16-19 at the new 40px estimate, row 15 measured
    // at 60. Index 20 therefore starts at 19*40 + 60 = 820, and the reader was
    // exactly at the top of index 20.
    expect(list.scrollTop).toBe(820);
  });

  test('retires the settle generation from input events, not from scroll offsets', async () => {
    // Source-shape for the mechanism, because the harness cannot hold a settle loop
    // in flight: it converges on its first attempt, so a user event never arrives
    // while one is running. What IS pinned here is that takeover is detected from
    // INPUT rather than inferred from offsets — the previous offset-comparison
    // version classified a smooth scroll's own intermediate events as interruption
    // and cancelled the settle pass that smooth scrolling exists to need.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();

    // Scrolling is no longer where takeover is decided.
    const scrollHandler = source.slice(
      source.indexOf('function handleScroll('),
      source.indexOf('function retireSettleLoop('),
    );
    expect(scrollHandler).not.toContain('scrollToIndexGeneration');

    // Input events are.
    expect(source).toContain('function retireSettleLoop()');
    for (const handler of [
      'function handleWheel(',
      'function handlePointerDown(',
      'function handleTouchStart(',
      'function handleKeyDown(',
    ]) {
      expect(source).toContain(handler);
    }
    // A letter keypress is not a viewport takeover, and neither is an arrow across an
    // axis that does not overflow — it scrolls nothing, so retiring a settle loop for
    // it abandons a correction still owed to the destination.
    expect(source).toContain('scrollsMainAxis(event.key)');
  });

  test('still forwards consumer wheel, pointer, touch, and key handlers', async () => {
    // Four handlers were added to the root to detect takeover. Any of them
    // clobbering a consumer's own handler would be a silent regression, so this is
    // behavioural rather than structural.
    const calls: string[] = [];
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Events',
      onwheel: () => calls.push('wheel'),
      onpointerdown: () => calls.push('pointerdown'),
      ontouchstart: () => calls.push('touchstart'),
      onkeydown: () => calls.push('keydown'),
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    await fireEvent.wheel(list, { deltaY: 100 });
    await fireEvent.pointerDown(list);
    await fireEvent.touchStart(list, { touches: [] });
    await fireEvent.keyDown(list, { key: 'ArrowDown' });

    expect(calls).toEqual(['wheel', 'pointerdown', 'touchstart', 'keydown']);
  });

  test('clamps the re-anchor offset to the rebuilt anchor row', async () => {
    // A reader deep inside a tall row would, across a rebuild that shrinks it, be
    // carried many rows past the anchor — which then unmounts and can never be
    // remeasured to correct the position.
    //
    // The anchor row is deliberately UNMEASURED here, so its size comes from the
    // estimate and shrinks with it. An earlier version of this test used a MEASURED
    // anchor, whose size survives the estimate change; the carried-forward offset
    // then still fit inside the row and an unclamped implementation produced exactly
    // the same number, so the assertion passed either way.
    installFakeResizeObserver();
    const base = {
      items: makeItems(200),
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, itemHeight: 1_000, row: rowSnippet() });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );

    // Sit 900px into row 10, which spans [10000, 11000) at the large estimate.
    list.scrollTop = 10_900;
    await fireEvent.scroll(list);
    await tick();

    // The estimate collapses. Row 10 now spans [400, 440): its whole size is 40px,
    // far less than the 900px the reader was carrying inside it.
    await view.rerender({ ...base, itemHeight: 40, row: rowSnippet() });
    await tick();
    await tick();

    const anchorStart = 10 * 40;
    // Unclamped this lands at 400 + 900 = 1300, inside row 32.
    expect(list.scrollTop).toBeGreaterThanOrEqual(anchorStart);
    expect(list.scrollTop).toBeLessThanOrEqual(anchorStart + 40);
  });
});
