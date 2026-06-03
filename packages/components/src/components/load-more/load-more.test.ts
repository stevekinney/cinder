/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: LoadMore } = await import('./load-more.svelte');

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observeCalls: Element[];
  disconnectCalls: number;
};

class FakeIntersectionObserver {
  static records: ObserverRecord[] = [];

  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = {
      callback,
      options,
      observeCalls: [],
      disconnectCalls: 0,
    };
    FakeIntersectionObserver.records.push(this.record);
  }

  observe(target: Element) {
    this.record.observeCalls.push(target);
  }

  disconnect() {
    this.record.disconnectCalls += 1;
  }

  unobserve() {}
  takeRecords() {
    return [];
  }
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

function createEntry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
  return {
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: {} as DOMRectReadOnly,
    isIntersecting,
    rootBounds: null,
    target,
    time: Date.now(),
  };
}

beforeEach(() => {
  FakeIntersectionObserver.records = [];
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  cleanup();
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

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

    const sentinel = container.querySelector('.cinder-load-more__sentinel');
    const [record] = FakeIntersectionObserver.records;

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

    const [record] = FakeIntersectionObserver.records;
    // root threads through to the IntersectionObserver so the sentinel is
    // observed within a scrollable container rather than the viewport.
    expect(record?.options?.root).toBe(scrollContainer);
  });

  test('defaults root to null (viewport) when not provided', () => {
    render(LoadMore, { props: { onLoadMore: () => {} } });
    const [record] = FakeIntersectionObserver.records;
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

  test('an intersecting sentinel entry calls onLoadMore', async () => {
    let calls = 0;
    const { container } = render(LoadMore, {
      props: {
        onLoadMore: () => {
          calls += 1;
        },
      },
    });

    const sentinel = container.querySelector('.cinder-load-more__sentinel');
    const [record] = FakeIntersectionObserver.records;

    record?.callback([createEntry(sentinel as Element, true)], {} as IntersectionObserver);

    await waitFor(() => {
      expect(calls).toBe(1);
    });
  });

  test('ignores stale sentinel callbacks while loading or after an error', async () => {
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

    const sentinel = rendered.container.querySelector('.cinder-load-more__sentinel') as Element;
    const [record] = FakeIntersectionObserver.records;

    await rendered.rerender({
      onLoadMore: async () => {
        calls += 1;
      },
      loading: true,
    });

    record?.callback([createEntry(sentinel, true)], {} as IntersectionObserver);
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

    await fireEvent.click(rendered.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Retry loading' })).toBeDefined();
    });

    rejectNextRequest = false;
    record?.callback([createEntry(sentinel, true)], {} as IntersectionObserver);
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

    const sentinel = container.querySelector('.cinder-load-more__sentinel');
    const [record] = FakeIntersectionObserver.records;

    record?.callback([createEntry(sentinel as Element, false)], {} as IntersectionObserver);

    expect(calls).toBe(0);
  });

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

  test('manual loads reset the sentinel retry budget after a failure', async () => {
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

    const sentinel = rendered.container.querySelector('.cinder-load-more__sentinel') as Element;
    const [record] = FakeIntersectionObserver.records;

    record?.callback([createEntry(sentinel, true)], {} as IntersectionObserver);

    await waitFor(() => {
      expect(rendered.getByRole('button', { name: 'Retry loading' })).toBeDefined();
    });

    shouldFail = false;
    await fireEvent.click(rendered.getByRole('button', { name: 'Retry loading' }));

    await waitFor(() => {
      expect(calls).toBe(2);
    });

    record?.callback([createEntry(sentinel, true)], {} as IntersectionObserver);

    await waitFor(() => {
      expect(calls).toBe(3);
    });
  });

  test('calls onError when onLoadMore rejects', async () => {
    let seen: unknown;
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          throw new Error('failed');
        },
        onError: (error: unknown) => {
          seen = error;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(seen).toBeInstanceOf(Error);
    });
  });

  test('announces the end-of-list message when hasMore is false on initial mount', async () => {
    // statusText is `$derived(hasMore ? '' : endOfListMessage)`, so an initially-exhausted
    // list announces its state — more correct than staying silent for an empty list. The
    // shared VisuallyHiddenLiveRegion blanks-then-sets on the next microtask (so a repeated
    // message still re-announces), so wait one tick for the text to land.
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        hasMore: false,
        endOfListMessage: 'All caught up',
      },
    });
    await waitFor(() => {
      expect(getByRole('status').textContent?.trim()).toBe('All caught up');
    });
  });

  test('announces the end-of-list message only after hasMore transitions to false', async () => {
    const rendered = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        hasMore: true,
        endOfListMessage: 'Nothing else to load',
      },
    });

    expect(rendered.getByRole('status').textContent?.trim()).toBe('');

    await rendered.rerender({
      onLoadMore: () => {},
      hasMore: false,
      endOfListMessage: 'Nothing else to load',
    });

    await waitFor(() => {
      expect(rendered.getByRole('status').textContent?.trim()).toBe('Nothing else to load');
    });
  });

  test('disables the button while loading unless the component is in retry mode', () => {
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        loading: true,
      },
    });

    const button = getByRole('button', { name: 'Load more' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test('shows a busy state while awaiting onLoadMore before the parent flips loading', async () => {
    let resolveRequest: (() => void) | undefined;

    const { container, getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () =>
          new Promise<void>((resolve) => {
            resolveRequest = resolve;
          }),
      },
    });

    const button = getByRole('button', { name: 'Load more' }) as HTMLButtonElement;

    await fireEvent.click(button);

    await waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
      expect(container.querySelector('.cinder-load-more__spinner')).toBeDefined();
    });

    resolveRequest?.();

    await waitFor(() => {
      expect(button.disabled).toBe(false);
      expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('false');
    });
  });
});
