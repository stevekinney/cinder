/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: UseIntersectionAttachFixture } =
  await import('../test/fixtures/use-intersection-attach-fixture.svelte');

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

describe('useIntersection', () => {
  test('constructs an observer with the provided options', () => {
    const root = document.createElement('section');

    const { getByTestId } = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: () => {},
        options: {
          root,
          rootMargin: '200px 0px',
          threshold: [0, 0.5, 1],
        },
      },
    });

    const sentinel = getByTestId('sentinel');
    const [record] = FakeIntersectionObserver.records;

    expect(record?.options).toEqual({
      root,
      rootMargin: '200px 0px',
      threshold: [0, 0.5, 1],
    });
    expect(record?.observeCalls).toEqual([sentinel]);
  });

  test('invokes the callback once per entry in order', () => {
    const seen: boolean[] = [];
    const { getByTestId } = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: (entry: IntersectionObserverEntry) => seen.push(entry.isIntersecting),
      },
    });

    const sentinel = getByTestId('sentinel');
    const [record] = FakeIntersectionObserver.records;

    record?.callback(
      [createEntry(sentinel, true), createEntry(sentinel, false)],
      {} as IntersectionObserver,
    );

    expect(seen).toEqual([true, false]);
  });

  test('disconnects when the attachment is destroyed', () => {
    const rendered = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: () => {},
      },
    });

    const [record] = FakeIntersectionObserver.records;

    rendered.unmount();

    expect(record?.disconnectCalls).toBeGreaterThanOrEqual(1);
  });

  test('does not observe while enabled returns false, then reconnects when it flips true', async () => {
    let enabled = false;

    const rendered = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: () => {},
        options: {
          enabled: () => enabled,
        },
      },
    });

    expect(FakeIntersectionObserver.records).toHaveLength(0);

    enabled = true;
    await rendered.rerender({
      onIntersect: () => {},
      options: {
        enabled: () => enabled,
      },
    });

    expect(FakeIntersectionObserver.records).toHaveLength(1);
    expect(FakeIntersectionObserver.records[0]?.observeCalls).toHaveLength(1);

    enabled = false;
    await rendered.rerender({
      onIntersect: () => {},
      options: {
        enabled: () => enabled,
      },
    });

    expect(FakeIntersectionObserver.records[0]?.disconnectCalls).toBeGreaterThanOrEqual(1);

    enabled = true;
    await rendered.rerender({
      onIntersect: () => {},
      options: {
        enabled: () => enabled,
      },
    });

    expect(FakeIntersectionObserver.records).toHaveLength(2);
  });

  test('observes immediately when enabled is omitted', () => {
    render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: () => {},
      },
    });

    expect(FakeIntersectionObserver.records).toHaveLength(1);
  });

  test('is a safe no-op when IntersectionObserver is unavailable', () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;

    const rendered = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: () => {},
      },
    });

    expect(FakeIntersectionObserver.records).toHaveLength(0);

    rendered.unmount();
  });
});
