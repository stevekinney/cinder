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

import type { VirtualListRef } from './virtual-list.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — dynamicSize', () => {
  afterEach(() => restoreResizeObserver());

  test('a newer scrollToIndex supersedes an in-flight settle loop', async () => {
    // Two overlapping settle loops write competing targets, and the older one can
    // land last — finishing rapid navigation on the wrong item.
    installFakeResizeObserver();
    let listRef: VirtualListRef | undefined;
    const { container } = render(VirtualList, {
      items: makeItems(500),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
      get ref() {
        return listRef;
      },
      set ref(next: VirtualListRef | undefined) {
        listRef = next;
      },
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    listRef?.scrollToIndex(400, { align: 'start' });
    listRef?.scrollToIndex(100, { align: 'start' });

    await tick();
    await tick();

    // The second call wins: index 100 at the 20px estimate.
    expect(list.scrollTop).toBe(2000);
  });

  test('releases the bottom pin while stickToBottom is disabled', async () => {
    // handleScroll only maintains the flag while the option is on, so a pin taken
    // before it was disabled would survive scrolling away — and re-enabling the
    // option would then jump the viewport to the bottom with no append at all.
    installFakeResizeObserver();
    const base = {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, stickToBottom: true });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    // Disable the option, then scroll away from the bottom.
    await view.rerender({ ...base, stickToBottom: false, row: rowSnippet() });
    await tick();
    list.scrollTop = 100;
    await fireEvent.scroll(list);
    await tick();

    // Re-enabling must not treat the stale pin as still valid.
    await view.rerender({ ...base, stickToBottom: true, row: rowSnippet() });
    await tick();
    await tick();

    expect(list.scrollTop).toBe(100);
  });

  test('drops cached measurements when dynamicSize is turned off', async () => {
    // Rows stop being observed in fixed mode, so a row that changes height in the
    // meantime would be rebuilt from its stale cached size the moment dynamic mode
    // came back — and an offscreen row may never be re-observed to correct it.
    installFakeResizeObserver();
    const base = {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      'aria-label': 'Events',
    };
    const view = render(VirtualList, { ...base, dynamicSize: true, row: rowSnippet() });

    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    const spacer = requiredInstance(
      view.container.querySelector('.cinder-virtual-list__spacer'),
      HTMLElement,
    );

    reportRowSizes(new Map([[0, 60]]));
    await tick();
    expect(spacer.style.blockSize).toBe('2040px');

    await view.rerender({ ...base, dynamicSize: false, row: rowSnippet() });
    await tick();
    expect(spacer.style.blockSize).toBe('2000px');

    // Back on: the stale 60px measurement must be gone, not reused.
    await view.rerender({ ...base, dynamicSize: true, row: rowSnippet() });
    await tick();
    expect(spacer.style.blockSize).toBe('2000px');
  });

  test('keeps the pin for an at-bottom reader when dynamicSize flips on during an append', async () => {
    // The mirror of the scrolled-up case above. Guarding the bottom check on the
    // mode being unchanged fixes the yank but silently drops the pin for a reader
    // who genuinely was at the bottom; carrying the previous run's real total is
    // what makes both directions correct.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    // 50 rows x 20px = 1000, minus a 200px viewport: 800 is the bottom.
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    await tick();

    expect(list.scrollTop).toBe(820);
  });

  test('measures the viewport before computing the append pin target', async () => {
    // Source-shape assertion, deliberately, because a behavioral one cannot
    // distinguish the two orderings in this harness: happy-dom's
    // getBoundingClientRect returns zero, so syncViewport falls through to parsing
    // the `height` prop — and the general viewport effect re-reads that prop on
    // change anyway, refreshing the measurement before the pin runs. In a real
    // browser the ordering is load-bearing: an update that appends AND shrinks
    // `height` computes the bottom from the pre-patch viewport and lands short,
    // with no re-pin effect in fixed mode to rescue it.
    //
    // Pinning the shape here keeps a refactor from silently reintroducing the
    // stale read. The real behavior is browser-verified in the Playwright suite.
    const source = await Bun.file(
      new URL('./virtual-list.svelte', import.meta.url).pathname,
    ).text();

    // Both bounds resolved relative to the guard, not from the top of the file:
    // `isPinnedToBottom = true;` also appears in the mount effect above, and an
    // absolute search would slice backwards into an empty string that trivially
    // "passes" every assertion below.
    // Anchored on `void tick().then(`, which marks the start of the pin body itself
    // rather than the guard above it. The guard's text keeps changing as modes are
    // added, and each time it does this test starts asserting against an empty slice
    // instead of failing — hence the explicit bounds check below.
    const pinStart = source.indexOf('void tick().then(');
    const pinBody = source.slice(pinStart, source.indexOf('isPinnedToBottom = true;', pinStart));

    const measureIndex = pinBody.indexOf('syncViewport(element)');
    const writeIndex = pinBody.indexOf('writeScrollOffset(');

    expect(measureIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(-1);
    // The measurement must come first, and its result — not the derived
    // viewportHeight — must be what the target is computed from.
    expect(measureIndex).toBeLessThan(writeIndex);
    expect(pinBody).toContain('const currentViewportHeight = syncViewport(element);');
    expect(pinBody).toContain('currentViewportHeight,');
  });

  test('lets the bottom pin win over an anchor correction in a mixed measurement batch', async () => {
    // A batch with resizes both above and below the anchor makes the two
    // mechanisms disagree: the pin targets the new total using every delta, the
    // correction only the deltas before the anchor. The correction must yield.
    installFakeResizeObserver();
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    await view.rerender({
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      stickToBottom: true,
      dynamicSize: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });
    await tick();
    await tick();
    expect(list.scrollTop).toBe(820);

    // Row 38 sits BEFORE the anchor (index 41 at offset 820) so it queues a real
    // correction, and row 50 is the newest edge. Total becomes 1020 + 20 + 60 =
    // 1100, so the bottom is 900 — while the correction alone would target 840.
    reportRowSizes(
      new Map([
        [38, 40],
        [50, 80],
      ]),
    );
    await tick();
    await tick();

    expect(list.scrollTop).toBe(900);
  });

  test('does not arm the pin when stickToBottom is disabled before the deferred callback runs', async () => {
    // The append pin defers past a tick. If the prop is disabled in between, the
    // disabled-mode effect clears the pin — and arming it again here would leave a
    // stale flag that no later scroll clears, so re-enabling would jump to the end
    // with no append behind it.
    installFakeResizeObserver();
    const base = {
      items: makeItems(51),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      'aria-label': 'Events',
    };
    const view = render(VirtualList, {
      items: makeItems(50),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickToBottom: true,
      row: rowSnippet(),
      'aria-label': 'Events',
    });

    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );
    list.scrollTop = 800;
    await fireEvent.scroll(list);
    await tick();

    // Append with the option still ON so the deferred callback is scheduled, then
    // disable it before the awaited tick resolves. Deliberately not awaited between
    // the two, which is what puts the disable inside the callback's window.
    void view.rerender({ ...base, stickToBottom: true, row: rowSnippet() });
    void view.rerender({ ...base, stickToBottom: false, row: rowSnippet() });
    await tick();
    await tick();

    list.scrollTop = 100;
    await fireEvent.scroll(list);
    await tick();

    // Re-enable. With a stale pin this jumps to the bottom; correctly, it holds.
    await view.rerender({ ...base, stickToBottom: true, row: rowSnippet() });
    await tick();
    await tick();

    expect(list.scrollTop).toBe(100);
  });
});
