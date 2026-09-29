import { describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import {
  createEntry,
  FakeIntersectionObserver,
  observerRecord,
  setupLoadMoreTests,
} from './load-more-test-support.ts';

setupHappyDom();
setupLoadMoreTests(cleanup);

const { default: LoadMore } = await import('./load-more.svelte');

describe('LoadMore', () => {
  test('renders the manual fallback button', () => {
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () => {},
      },
    });

    expect(getByRole('button', { name: 'Load more' })).toBeDefined();
  });

  test('uses the provided rootMargin for the sentinel observer', () => {
    const { container } = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        rootMargin: '320px 0px',
      },
    });

    const sentinel = requiredInstance(
      container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    expect(record?.options?.rootMargin).toBe('320px 0px');
    expect(record?.observeCalls).toEqual(sentinel ? [sentinel] : []);
  });

  test('uses the provided root element for the sentinel observer', () => {
    const scrollContainer = document.createElement('div');
    render(LoadMore, {
      props: {
        onLoadMore: () => {},
        root: scrollContainer,
      },
    });

    const record = observerRecord();
    // root threads through to the IntersectionObserver so the sentinel is
    // observed within a scrollable container rather than the viewport.
    expect(record?.options?.root).toBe(scrollContainer);
  });

  test('defaults root to null (viewport) when not provided', () => {
    render(LoadMore, { props: { onLoadMore: () => {} } });
    const record = observerRecord();
    expect(record?.options?.root ?? null).toBeNull();
  });

  test('clicking the button calls onLoadMore', async () => {
    let calls = 0;
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () => {
          calls += 1;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Load more' }));

    expect(calls).toBe(1);
  });

  test('manual loading while the sentinel is off-screen preserves its next entry trigger', async () => {
    let calls = 0;
    const rendered = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    record.callback([createEntry(sentinel, false)], record.observer);
    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));
    expect(calls).toBe(1);

    await waitFor(() => expect(FakeIntersectionObserver.records).toHaveLength(2));
    const currentRecord = observerRecord(-1);
    currentRecord.callback([createEntry(sentinel, false)], currentRecord.observer);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await waitFor(() => expect(calls).toBe(2));
  });

  test('manual loading consumes intersections queued by the previous observer', async () => {
    let calls = 0;
    let resolveManualRequest: (() => void) | undefined;
    const rendered = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
          if (calls === 1) {
            await new Promise<void>((resolve) => (resolveManualRequest = resolve));
          }
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const initialRecord = observerRecord();

    initialRecord.callback([createEntry(sentinel, false)], initialRecord.observer);
    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(calls).toBe(1));

    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);
    resolveManualRequest?.();

    await waitFor(() => {
      expect(FakeIntersectionObserver.records).toHaveLength(2);
      expect(rendered.getByRole('button', { name: 'Load more' }).hasAttribute('disabled')).toBe(
        false,
      );
    });
    expect(calls).toBe(1);

    const currentRecord = observerRecord(-1);
    currentRecord.callback([createEntry(sentinel, false)], currentRecord.observer);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await waitFor(() => expect(calls).toBe(2));
  });

  test('manual loading before the sentinel reports consumes a potentially visible entry', async () => {
    let calls = 0;
    const rendered = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));
    expect(calls).toBe(1);

    record.callback([createEntry(sentinel, true)], record.observer);
    await Promise.resolve();
    expect(calls).toBe(1);
  });

  test('loads an armed intersecting sentinel when the component becomes idle', async () => {
    let calls = 0;
    const rendered = render(LoadMore, {
      props: {
        loading: true,
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    record.callback([createEntry(sentinel, true)], record.observer);
    expect(calls).toBe(0);

    await rendered.rerender({
      loading: false,
      onLoadMore: async () => {
        calls += 1;
      },
    });

    await waitFor(() => expect(calls).toBe(1));
  });
});
