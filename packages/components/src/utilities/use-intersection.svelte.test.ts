/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: UseIntersectionAttachFixture } =
  await import('../test/fixtures/use-intersection-attach-fixture.svelte');

type ObserverRecord = {
  observer: IntersectionObserver;
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observeCalls: Element[];
  disconnectCalls: number;
};

class FakeIntersectionObserver implements IntersectionObserver {
  static records: ObserverRecord[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin: string;
  // `IntersectionObserverInit` declares no `scrollMargin` (the installed DOM
  // lib has the property on no IntersectionObserver type at all), so no caller
  // can supply one and `options?.scrollMargin ?? ''` was always `''`. Declared
  // as the constant it already resolved to, matching the other fake observers
  // in this workspace. Restore the options read only once the DOM lib gains
  // the field, and only if a test actually needs to set it.
  readonly scrollMargin = '';
  readonly thresholds: readonly number[];

  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? '0px';
    this.thresholds =
      typeof options?.threshold === 'number' ? [options.threshold] : (options?.threshold ?? [0]);
    this.record = {
      observer: this,
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
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

function createEntry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
  return {
    boundingClientRect: target.getBoundingClientRect(),
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: target.getBoundingClientRect(),
    isIntersecting,
    rootBounds: null,
    target,
    time: Date.now(),
  };
}

beforeEach(() => {
  FakeIntersectionObserver.records = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver;
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

    record?.callback([createEntry(sentinel, true), createEntry(sentinel, false)], record.observer);

    expect(seen).toEqual([true, false]);
  });

  test('ignores queued observer entries after enabled flips false', async () => {
    let enabled = true;
    const seen: boolean[] = [];

    const rendered = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: (entry: IntersectionObserverEntry) => seen.push(entry.isIntersecting),
        options: {
          enabled: () => enabled,
        },
      },
    });

    const sentinel = rendered.getByTestId('sentinel');
    const [record] = FakeIntersectionObserver.records;

    enabled = false;
    await rendered.rerender({
      onIntersect: (entry: IntersectionObserverEntry) => seen.push(entry.isIntersecting),
      options: {
        enabled: () => enabled,
      },
    });

    record?.callback([createEntry(sentinel, true)], record.observer);

    expect(seen).toEqual([]);
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

  test('ignores queued entries from an observer that was replaced after reconnecting', async () => {
    let enabled = true;
    const seen: boolean[] = [];

    const rendered = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: (entry: IntersectionObserverEntry) => seen.push(entry.isIntersecting),
        options: { enabled: () => enabled },
      },
    });

    const sentinel = rendered.getByTestId('sentinel');
    const firstRecord = FakeIntersectionObserver.records[0];

    enabled = false;
    await rendered.rerender({
      onIntersect: (entry: IntersectionObserverEntry) => seen.push(entry.isIntersecting),
      options: { enabled: () => enabled },
    });
    enabled = true;
    await rendered.rerender({
      onIntersect: (entry: IntersectionObserverEntry) => seen.push(entry.isIntersecting),
      options: { enabled: () => enabled },
    });

    firstRecord?.callback([createEntry(sentinel, false)], firstRecord.observer);
    const secondRecord = FakeIntersectionObserver.records[1];
    secondRecord?.callback([createEntry(sentinel, true)], secondRecord.observer);

    expect(seen).toEqual([true]);
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
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: undefined });

    const rendered = render(UseIntersectionAttachFixture, {
      props: {
        onIntersect: () => {},
      },
    });

    expect(FakeIntersectionObserver.records).toHaveLength(0);

    rendered.unmount();
  });
});
