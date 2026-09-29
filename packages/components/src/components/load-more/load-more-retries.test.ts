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
  test('switches to the retry label after a rejected load', async () => {
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          throw new Error('network');
        },
        retryLabel: 'Try again',
      },
    });

    const button = getByRole('button', { name: 'Load more' });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Try again' })).toBeDefined();
    });
  });

  test('manual loads reset the sentinel request cap after a failure', async () => {
    let calls = 0;
    let shouldFail = true;

    const rendered = render(LoadMore, {
      props: {
        maxRetries: 1,
        onLoadMore: async () => {
          calls += 1;
          if (shouldFail) {
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

    record.callback([createEntry(sentinel, true)], record.observer);

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Retry loading' })).toBeDefined();
    });

    shouldFail = false;
    await fireEvent.click(rendered.getByRole('button', { name: 'Retry loading' }));

    await waitFor(() => {
      expect(calls).toBe(2);
    });

    const resetSentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const resetRecord = observerRecord(-1);
    resetRecord.callback([createEntry(resetSentinel, false)], resetRecord.observer);
    resetRecord.callback([createEntry(resetSentinel, true)], resetRecord.observer);

    await waitFor(() => {
      expect(calls).toBe(3);
    });
  });

  test('raising maxRetries re-arms the sentinel with the reconnected observer', async () => {
    let calls = 0;
    const rendered = render(LoadMore, {
      props: {
        maxRetries: 1,
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const initialRecord = observerRecord();
    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);
    await waitFor(() => expect(calls).toBe(1));

    await rendered.rerender({
      maxRetries: 2,
      onLoadMore: async () => {
        calls += 1;
      },
    });

    await waitFor(() => expect(FakeIntersectionObserver.records).toHaveLength(2));
    const currentRecord = observerRecord(-1);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await waitFor(() => expect(calls).toBe(2));
  });

  test('a manual load at the request cap keeps the reconnected sentinel disarmed', async () => {
    let calls = 0;
    const rendered = render(LoadMore, {
      props: {
        maxRetries: 1,
        onLoadMore: async () => {
          calls += 1;
        },
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const initialRecord = observerRecord();
    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);
    await waitFor(() => expect(calls).toBe(1));

    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));
    await waitFor(() => {
      expect(calls).toBe(2);
      expect(FakeIntersectionObserver.records).toHaveLength(2);
    });

    const currentRecord = observerRecord(-1);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await Promise.resolve();
    expect(calls).toBe(2);

    currentRecord.callback([createEntry(sentinel, false)], currentRecord.observer);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await waitFor(() => expect(calls).toBe(3));
  });

  test('an in-flight manual load stays disarmed when maxRetries increases', async () => {
    let calls = 0;
    let resolveManualRequest: (() => void) | undefined;
    const onLoadMore = async () => {
      calls += 1;
      if (calls === 2) {
        await new Promise<void>((resolve) => (resolveManualRequest = resolve));
      }
    };
    const rendered = render(LoadMore, {
      props: {
        maxRetries: 1,
        onLoadMore,
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const initialRecord = observerRecord();
    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);
    await waitFor(() => expect(calls).toBe(1));

    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(calls).toBe(2));
    await rendered.rerender({ maxRetries: 2, onLoadMore });
    resolveManualRequest?.();

    await waitFor(() => {
      expect(FakeIntersectionObserver.records).toHaveLength(2);
      expect(rendered.getByRole('button', { name: 'Load more' }).hasAttribute('disabled')).toBe(
        false,
      );
    });

    const currentRecord = observerRecord(-1);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await Promise.resolve();
    expect(calls).toBe(2);

    currentRecord.callback([createEntry(sentinel, false)], currentRecord.observer);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await waitFor(() => expect(calls).toBe(3));
  });

  test('a direct manual promise stays disarmed when its resolution raises maxRetries', async () => {
    let calls = 0;
    let resolveManualRequest: (() => void) | undefined;
    const onLoadMore = () => {
      calls += 1;
      if (calls === 2) {
        return new Promise<void>((resolve) => (resolveManualRequest = resolve));
      }
      return Promise.resolve();
    };
    const rendered = render(LoadMore, {
      props: {
        maxRetries: 1,
        onLoadMore,
      },
    });

    const sentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const initialRecord = observerRecord();
    initialRecord.callback([createEntry(sentinel, true)], initialRecord.observer);
    await waitFor(() => expect(calls).toBe(1));

    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(calls).toBe(2));
    resolveManualRequest?.();
    const rerenderPromise = rendered.rerender({ maxRetries: 2, onLoadMore });
    await rerenderPromise;

    await waitFor(() => expect(FakeIntersectionObserver.records).toHaveLength(2));
    const currentRecord = observerRecord(-1);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await Promise.resolve();
    expect(calls).toBe(2);

    currentRecord.callback([createEntry(sentinel, false)], currentRecord.observer);
    currentRecord.callback([createEntry(sentinel, true)], currentRecord.observer);
    await waitFor(() => expect(calls).toBe(3));
  });

  test('a retry while visible does not queue a second sentinel request', async () => {
    let calls = 0;
    let resolveRetry: (() => void) | undefined;

    const rendered = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
          if (calls === 1) throw new Error('network');
          if (calls === 2) await new Promise<void>((resolve) => (resolveRetry = resolve));
        },
      },
    });

    const initialSentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();
    record.callback([createEntry(initialSentinel, true)], record.observer);

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Retry loading' })).toBeDefined();
    });

    await fireEvent.click(rendered.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(calls).toBe(2));

    const retrySentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const retryRecord = observerRecord(-1);
    retryRecord.callback([createEntry(retrySentinel, true)], retryRecord.observer);
    resolveRetry?.();

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Load more' }).hasAttribute('disabled')).toBe(
        false,
      );
    });
    expect(calls).toBe(2);
  });

  test('a retry disarms a recreated sentinel after the old sentinel left view', async () => {
    let calls = 0;
    let rejectInitial: ((reason?: unknown) => void) | undefined;
    let resolveRetry: (() => void) | undefined;

    const rendered = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          calls += 1;
          if (calls === 1) {
            await new Promise<void>((_resolve, reject) => (rejectInitial = reject));
          }
          if (calls === 2) await new Promise<void>((resolve) => (resolveRetry = resolve));
        },
      },
    });

    const initialSentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const record = observerRecord();
    record.callback([createEntry(initialSentinel, true)], record.observer);
    await waitFor(() => expect(calls).toBe(1));
    record.callback([createEntry(initialSentinel, false)], record.observer);
    rejectInitial?.(new Error('network'));

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Retry loading' })).toBeDefined();
    });

    await fireEvent.click(rendered.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(calls).toBe(2));

    const retrySentinel = requiredInstance(
      rendered.container.querySelector('.cinder-load-more__sentinel'),
      Element,
    );
    const retryRecord = observerRecord(-1);
    retryRecord.callback([createEntry(retrySentinel, true)], retryRecord.observer);
    resolveRetry?.();

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Load more' }).hasAttribute('disabled')).toBe(
        false,
      );
    });
    expect(calls).toBe(2);
  });
});
