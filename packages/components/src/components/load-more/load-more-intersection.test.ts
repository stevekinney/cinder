import { describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { cleanup, render, waitFor } from '@testing-library/svelte';
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
  test('an intersecting sentinel entry calls onLoadMore', async () => {
    let calls = 0;
    const { container } = render(LoadMore, {
      props: {
        onLoadMore: () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    record.callback([createEntry(sentinel, true)], record.observer);

    await waitFor(() => {
      expect(calls).toBe(1);
    });
  });

  test('does not reconnect or load again while the sentinel remains intersecting', async () => {
    let calls = 0;
    const { container } = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const initialRecord = observerRecord();

    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);

    await waitFor(() => {
      expect(calls).toBe(1);
      expect(FakeIntersectionObserver.records).toHaveLength(1);
    });

    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);

    await Promise.resolve();
    expect(calls).toBe(1);
  });

  test('re-arms auto-loading after the sentinel leaves and re-enters the observer root', async () => {
    let calls = 0;
    const { container } = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    record.callback([createEntry(sentinel, true)], record.observer);
    await waitFor(() => expect(calls).toBe(1));

    const resetSentinel = requiredInstance(
      container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const resetRecord = observerRecord(-1);
    resetRecord.callback([createEntry(resetSentinel, false)], resetRecord.observer);
    resetRecord.callback([createEntry(resetSentinel, true)], resetRecord.observer);

    await waitFor(() => expect(calls).toBe(2));
  });

  test('replays a busy sentinel entry once and ignores stale callbacks after an error', async () => {
    let calls = 0;
    let rejectNextRequest = false;

    const rendered = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
          if (rejectNextRequest) {
            throw new Error('network');
          }
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    await rendered.rerender({
      onLoadMore: async () => {
        calls += 1;
      },
      loading: true,
    });

    record.callback([createEntry(sentinel, true)], record.observer);
    expect(calls).toBe(0);

    rejectNextRequest = true;
    await rendered.rerender({
      onLoadMore: async () => {
        calls += 1;
        if (rejectNextRequest) {
          throw new Error('network');
        }
      },
      loading: false,
    });

    await waitFor(() => {
      expect(calls).toBe(1);
      expect(rendered.getByRole('button', { name: 'Retry loading' })).toBeDefined();
    });

    rejectNextRequest = false;
    record.callback([createEntry(sentinel, true)], record.observer);
    expect(calls).toBe(1);
  });

  test('does not call onLoadMore for a non-intersecting sentinel entry', () => {
    let calls = 0;
    const { container } = render(LoadMore, {
      props: {
        onLoadMore: () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();

    record.callback([createEntry(sentinel, false)], record.observer);

    expect(calls).toBe(0);
  });
});
