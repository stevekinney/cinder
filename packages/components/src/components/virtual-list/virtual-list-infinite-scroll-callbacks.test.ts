/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { itemId, makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — infinite scroll callbacks', () => {
  const localRowSnippet = rowSnippet;
  const localMakeItems = makeItems;
  const localScopeMarker = true;

  test('fires onEndReached once per approach rather than once per scroll event', async () => {
    let endReachedCount = 0;
    const { container } = render(VirtualList, {
      items: localMakeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onEndReached: () => {
        endReachedCount += 1;
      },
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    expect(endReachedCount).toBe(0);

    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(1));

    // Several more updates that all remain near the end must not re-fire.
    list.scrollTop = 3_820;
    await fireEvent.scroll(list);
    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    expect(endReachedCount).toBe(1);
  });

  test('re-arms once the requested items arrive', async () => {
    let endReachedCount = 0;
    const props = (count: number) => ({
      items: localMakeItems(count),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onEndReached: () => {
        endReachedCount += 1;
      },
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props(200));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(1));

    // A page arrives. Without the item-count release the latch would stay set and
    // the list could never request a second page.
    await rerender(props(400));
    list.scrollTop = 7_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(2));
  });

  test('a prepend in response to onStartReached does not immediately ask for another page', async () => {
    // Caught from a captured screenshot, not from a unit test: the documentation
    // example read "2 older pages" on first paint. The callback fires, the consumer
    // prepends, and the component queues a correction to hold the reader's row — but
    // the effect re-runs on the new item count BEFORE that correction lands, still
    // sees the reader at the start, and asks again. A real API gets fetched twice.
    let startReachedCount = 0;
    const pageSize = 50;
    let firstId = 0;
    const buildItems = (count: number, offset: number) => {
      if (!localScopeMarker) return [];
      return Array.from({ length: count }, (_, index) => ({ id: `key-${index - offset}` }));
    };

    const props = (count: number, offset: number) => ({
      items: buildItems(count, offset),
      itemHeight: 40,
      height: '320px',
      overscan: 5,
      getKey: (item: unknown) => itemId(item),
      onStartReached: () => {
        startReachedCount += 1;
      },
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props(100, firstId));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    await waitFor(() => expect(startReachedCount).toBe(1));

    // The consumer's response: a page of older rows at the front.
    firstId += pageSize;
    await rerender(props(100 + pageSize, firstId));
    await tick();
    await tick();

    expect(startReachedCount).toBe(1);
  });

  test('re-enabling one callback fires again, even at the same position and count', async () => {
    // The latch is per edge. Resetting it only when BOTH callbacks are absent left
    // the removed edge latched, so putting that one callback back at the same
    // position and item count found it already set and stayed silent.
    let endReachedCount = 0;
    const onEndReached = () => {
      endReachedCount += 1;
    };
    // Passed explicitly as undefined, which is how a consumer disables a handler
    // conditionally — and the only way to clear it here, since `rerender` merges
    // props rather than replacing them, so an omitted key keeps its previous value.
    const props = (handler: (() => void) | undefined) => ({
      items: localMakeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onStartReached: () => {},
      onEndReached: handler,
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props(onEndReached));
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    list.scrollTop = 3_800;
    await fireEvent.scroll(list);
    await waitFor(() => expect(endReachedCount).toBe(1));

    // Remove the callback while the reader stays exactly where they are.
    await rerender(props(undefined));
    await tick();

    // Put it back, still near the end, still the same item count.
    await rerender(props(onEndReached));
    await waitFor(() => expect(endReachedCount).toBe(2));
  });

  test('fires onStartReached near the start', async () => {
    let startReachedCount = 0;
    render(VirtualList, {
      items: localMakeItems(200),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onStartReached: () => {
        startReachedCount += 1;
      },
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    // A list mounted at the top is already at its start edge.
    await waitFor(() => expect(startReachedCount).toBe(1));
  });

  test('a load-more loop terminates once the list overflows the viewport', async () => {
    // The runaway case: every fire appends, every append re-arms the latch. What
    // must stop the loop is proximity going false as the list outgrows the
    // viewport — not the latch, which deliberately releases on a count change.
    let fireCount = 0;
    let itemCount = 5;
    const props = () => ({
      items: localMakeItems(itemCount),
      itemHeight: 20,
      height: '200px',
      overscan: 2,
      onEndReached: () => {
        fireCount += 1;
      },
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    const { container, rerender } = render(VirtualList, props());
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    // Stand in for a consumer that appends a page on every call. The guard is the
    // assertion: a list that never stops asking would exhaust it.
    let rounds = 0;
    let previousFireCount = -1;
    while (fireCount !== previousFireCount && rounds < 20) {
      previousFireCount = fireCount;
      itemCount += 5;
      await rerender(props());
      await tick();
      rounds += 1;
    }

    expect(rounds).toBeLessThan(20);
    // And it stopped because the end genuinely left range, not because nothing
    // ever fired.
    expect(fireCount).toBeGreaterThan(0);
  });

  test('neither callback fires for an empty list', async () => {
    // An empty list has no edge to reach, and firing here would ask a source that
    // returned nothing to return nothing again.
    let calls = 0;
    render(VirtualList, {
      items: [],
      itemHeight: 20,
      height: '200px',
      onEndReached: () => {
        calls += 1;
      },
      onStartReached: () => {
        calls += 1;
      },
      row: localRowSnippet(),
      'aria-label': 'Feed',
    });

    await tick();
    await tick();
    expect(calls).toBe(0);
  });
});
