/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

/**
 * COR-374: a held or rapidly-repeated ArrowDown under `smoothScroll` must
 * advance one row per press, not fewer — see the ticket for the bug and the
 * five ways a pending destination can go stale.
 *
 * Every list below fixes `itemHeight` at 20px with a single 20px sticky
 * header at index 0 (`stickyItems: [0]`), so `firstUncoveredIndex` starts at
 * row 1 and a target index `n` writes to pixel `n * 20 - 20` — the row's
 * start less the header's inset. Fixed-height mode (`dynamicSize` is off
 * throughout) so `runScrollToIndex` never retries; the only thing keeping a
 * destination alive across presses is `pendingKeyboardIndex` itself.
 *
 * happy-dom cannot animate a real smooth scroll, but its own `Element.scroll`
 * applies a `behavior: 'smooth'` write on a DEFERRED timer rather than
 * synchronously — see `node_modules/happy-dom/.../Element.js`. That is
 * enough to reproduce the bug's actual mechanism: two keydowns dispatched
 * back to back, before either deferred write has applied, see the exact
 * "live position still lags the destination" gap a real browser's animation
 * produces. Cases that need the destination to actually EXPIRE (1, 2, 5) use
 * an explicit invalidation input or real elapsed animation frames instead,
 * which is deterministic here without needing genuine motion.
 */
describe('VirtualList — coalescing a held ArrowDown under smoothScroll (COR-374)', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  function renderStickySmoothList(overrides: Record<string, unknown> = {}) {
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      smoothScroll: true,
      row: rowSnippet(),
      'aria-label': 'Feed',
      ...overrides,
    });
    return container;
  }

  function arrowDown(target: EventTarget): void {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
  }

  /** Lets every timer- or frame-deferred write from the presses above settle. */
  async function letDeferredWritesApply(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function nextAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      globalThis.requestAnimationFrame(() => resolve());
    });
  }

  test('two ArrowDown presses fired before the first settles land two rows on, not one', async () => {
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    // Row 0 is the 20px header, so the reader starts uncovered at row 1. Fired
    // back to back, with neither press's deferred smooth write yet applied,
    // a broken implementation re-derives BOTH presses from that same live
    // row 1 and both resolve to row 2 — the bug this ticket fixes.
    arrowDown(list);
    arrowDown(list);
    await letDeferredWritesApply();

    // Two presses, two rows: 1 -> 2 -> 3. Row 3 starts at 60, less the 20px
    // header inset.
    expect(Math.round(list.scrollTop)).toBe(3 * 20 - 20);
  });

  test('four held presses advance four rows', async () => {
    // The same mechanism at a wider margin, closer to the acceptance
    // criterion's "N presses, N rows" — proven for real motion by the
    // Playwright test; this pins the underlying state machine handles more
    // than a coincidental two.
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    for (let index = 0; index < 4; index += 1) arrowDown(list);
    await letDeferredWritesApply();

    // 1 -> 2 -> 3 -> 4 -> 5.
    expect(Math.round(list.scrollTop)).toBe(5 * 20 - 20);
  });

  test('case 1: a wheel event retires the pending destination', async () => {
    // Revert to prove this fails: remove `retirePendingKeyboardIndex();` from
    // `handleWheel` in virtual-list.svelte. Without it this test's second
    // press still reads the FIRST press's pending destination (row 2) and
    // resolves to row 3 (scrollTop 40) instead of row 2 (scrollTop 20).
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    arrowDown(list);
    list.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true }));
    arrowDown(list);
    await letDeferredWritesApply();

    // The wheel event means "the reader took the scroll back" — the second
    // press has to resolve fresh from the live position (still row 1, since
    // neither deferred write has applied), landing on row 2 again, not on
    // row 3 as an uninterrupted second press would.
    expect(Math.round(list.scrollTop)).toBe(2 * 20 - 20);
  });

  test('case 1: a pointerdown event retires the pending destination', async () => {
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    arrowDown(list);
    list.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    arrowDown(list);
    await letDeferredWritesApply();

    expect(Math.round(list.scrollTop)).toBe(2 * 20 - 20);
  });

  test('case 1: a touchstart event retires the pending destination', async () => {
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    arrowDown(list);
    // happy-dom's `TouchEvent` constructor rejects a `touches` list built from
    // plain objects, and the handler never reads the event's payload —
    // only that one fired — so an empty init is enough.
    list.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }));
    arrowDown(list);
    await letDeferredWritesApply();

    expect(Math.round(list.scrollTop)).toBe(2 * 20 - 20);
  });

  test('case 2: Space retires the pending destination, matching the native scroll it falls through to', async () => {
    // Revert to prove this fails: in `handleKeyDown`, change
    // `if (scrollsMainAxis(event.key)) retirePendingKeyboardIndex();` to an
    // unconditional call (or delete it). Without the fix this test's second
    // press resolves from the stale row-2 destination and lands on row 3
    // (scrollTop 40) instead of row 2 (scrollTop 20) — Space scrolled the
    // container natively, and the destination never heard about it.
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    arrowDown(list);
    list.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    arrowDown(list);
    await letDeferredWritesApply();

    expect(Math.round(list.scrollTop)).toBe(2 * 20 - 20);
  });

  test('case 2: Shift+Space also retires the pending destination', async () => {
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    arrowDown(list);
    list.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', shiftKey: true, bubbles: true, cancelable: true }),
    );
    arrowDown(list);
    await letDeferredWritesApply();

    expect(Math.round(list.scrollTop)).toBe(2 * 20 - 20);
  });

  test('case 3: a prepend shifts the pending destination along with every other tracked index', async () => {
    // Revert to prove this fails: delete the
    // `if (growth.kind === 'prepended' && pendingKeyboardIndex !== null)`
    // block in the items-growth `$effect.pre`. Without it the second press
    // below resolves from the STALE index 2 — which after the prepend is a
    // different item ten rows earlier than where the first press was
    // actually headed — landing on row 3 (scrollTop 40) instead of row 13
    // (scrollTop 240).
    //
    // Keyed items are required here: with no `getKey`, a row's key IS its
    // index, so a prepend and a no-op look identical to `classifyItemGrowth`
    // and it is never classified as `'prepended'` at all.
    const initialItems = makeItems(1_000);
    const view = render(VirtualList, {
      items: initialItems,
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      smoothScroll: true,
      getKey: (item: unknown) => item as string,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });
    await waitFor(() => expect(renderedRows(view.container).length).toBeGreaterThan(0));
    const list = requiredInstance(
      view.container.querySelector('.cinder-virtual-list'),
      HTMLElement,
    );

    // Row 1 -> row 2, synchronously, before any settle.
    arrowDown(list);

    const prepended = Array.from({ length: 10 }, (_unused, index) => `Prepended ${index}`);
    await view.rerender({
      items: [...prepended, ...initialItems],
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      smoothScroll: true,
      getKey: (item: unknown) => item as string,
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    arrowDown(list);
    await letDeferredWritesApply();

    // The pending row-2 destination is now row 12 (2 + the 10 prepended
    // rows), so the second press — still coalesced onto it — lands on 13.
    expect(Math.round(list.scrollTop)).toBe(13 * 20 - 20);
  });

  test('case 4: an off-axis arrow does not retire the pending destination', async () => {
    // Revert to prove this fails: in `handleKeyDown`, change
    // `if (scrollsMainAxis(event.key)) retirePendingKeyboardIndex();` to
    // retire unconditionally on a null target. Without the `scrollsMainAxis`
    // guard, ArrowLeft below — which scrolls nothing in a vertical list —
    // would also retire the destination, and the second ArrowDown would
    // resolve from the live row 1 again (scrollTop 20) instead of continuing
    // the coalesced sequence to row 3 (scrollTop 40).
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    arrowDown(list);
    list.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    );
    arrowDown(list);
    await letDeferredWritesApply();

    expect(Math.round(list.scrollTop)).toBe(3 * 20 - 20);
  });

  test('case 5: a programmatic scroll write is reflected once the destination settles', async () => {
    // Revert to prove this fails: in `watchPendingKeyboardIndex`, delete the
    // final `pendingKeyboardIndex = null;` (leave the wait, drop the clear).
    // Without it, the destination this test's first press arms never
    // expires — the third press below still resolves from the STALE row-2
    // destination and lands on row 3 (`calls` ends in 40) instead of
    // continuing from the row the programmatic write actually left the
    // reader on, row 10 (`calls` ends in 180).
    //
    // `scrollTo` is stubbed to record its target rather than apply it, so the
    // only thing that moves `scrollTop` in this test is the explicit
    // "programmatic" write below — isolating the one signal
    // `watchPendingKeyboardIndex` is supposed to react to (the browser's own
    // motion having stopped) from every OTHER thing that could move
    // `scrollTop` in this environment.
    const container = renderStickySmoothList();
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const calls: number[] = [];
    Object.defineProperty(list, 'scrollTo', {
      configurable: true,
      value: (options: ScrollToOptions) => {
        calls.push(options?.top ?? 0);
      },
    });

    // Row 1 -> row 2. Recorded, never applied — `scrollTop` does not move.
    arrowDown(list);
    expect(calls).toEqual([2 * 20 - 20]);

    // A consumer writing `scrollTop` directly, a fragment link, or
    // find-in-page — none of it goes through this component's own wheel,
    // pointer, touch, or key handlers, so nothing else here would ever
    // invalidate the destination the first press armed.
    list.scrollTop = 160;
    await fireEvent.scroll(list);

    // Real animation frames, not a Svelte `tick()`: `waitForScrollSettled`
    // is driven by `requestAnimationFrame`, and needs two CONSECUTIVE equal
    // readings before it resolves — nothing moves `scrollTop` after the
    // write above, so this settles at the minimum, with generous margin.
    for (let frame = 0; frame < 6; frame += 1) await nextAnimationFrame();

    arrowDown(list);

    // Row 9 is the first the programmatic write leaves uncovered (scrollTop
    // 160 + the 20px header = offset 180, which is row 9's start), so the
    // destination the settled write leaves behind steps to row 10.
    expect(calls).toEqual([2 * 20 - 20, 10 * 20 - 20]);
  });
});
