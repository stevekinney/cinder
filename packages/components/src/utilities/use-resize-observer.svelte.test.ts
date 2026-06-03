/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: UseResizeObserverAttachFixture } =
  await import('../test/fixtures/use-resize-observer-attach-fixture.svelte');

type ObserverRecord = {
  callback: ResizeObserverCallback;
  observeCalls: { target: Element; options: ResizeObserverOptions | undefined }[];
  disconnectCalls: number;
};

class FakeResizeObserver {
  static records: ObserverRecord[] = [];

  private readonly record: ObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.record = {
      callback,
      observeCalls: [],
      disconnectCalls: 0,
    };
    FakeResizeObserver.records.push(this.record);
  }

  observe(target: Element, options?: ResizeObserverOptions) {
    this.record.observeCalls.push({ target, options });
  }

  disconnect() {
    this.record.disconnectCalls += 1;
  }

  unobserve() {}
}

const originalResizeObserver = globalThis.ResizeObserver;

function createEntry(target: Element): ResizeObserverEntry {
  return {
    borderBoxSize: [],
    contentBoxSize: [],
    contentRect: target.getBoundingClientRect(),
    devicePixelContentBoxSize: [],
    target,
  };
}

beforeEach(() => {
  FakeResizeObserver.records = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = originalResizeObserver;
});

describe('useResizeObserver', () => {
  test('constructs an observer with the provided box option', () => {
    const { getByTestId } = render(UseResizeObserverAttachFixture, {
      props: {
        onResize: () => {},
        options: {
          box: 'border-box',
        },
      },
    });

    const sentinel = getByTestId('sentinel');
    const [record] = FakeResizeObserver.records;

    expect(record?.observeCalls).toHaveLength(1);
    expect(record?.observeCalls[0]?.target).toBe(sentinel);
    expect(record?.observeCalls[0]?.options).toEqual({ box: 'border-box' });
  });

  test('invokes the callback with the entries array', () => {
    const seen: Element[] = [];
    const { getByTestId } = render(UseResizeObserverAttachFixture, {
      props: {
        onResize: (entries: ResizeObserverEntry[]) => {
          for (const entry of entries) {
            seen.push(entry.target);
          }
        },
      },
    });

    const sentinel = getByTestId('sentinel');
    const [record] = FakeResizeObserver.records;

    record?.callback([createEntry(sentinel)], {} as ResizeObserver);

    expect(seen).toEqual([sentinel]);
  });

  test('ignores queued observer entries after enabled flips false', async () => {
    let enabled = true;
    const seen: Element[] = [];

    const rendered = render(UseResizeObserverAttachFixture, {
      props: {
        onResize: (entries: ResizeObserverEntry[]) => {
          for (const entry of entries) {
            seen.push(entry.target);
          }
        },
        options: {
          enabled: () => enabled,
        },
      },
    });

    const sentinel = rendered.getByTestId('sentinel');
    const [record] = FakeResizeObserver.records;

    enabled = false;
    await rendered.rerender({
      onResize: (entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          seen.push(entry.target);
        }
      },
      options: {
        enabled: () => enabled,
      },
    });

    record?.callback([createEntry(sentinel)], {} as ResizeObserver);

    expect(seen).toEqual([]);
  });

  test('disconnects when the attachment is destroyed', () => {
    const rendered = render(UseResizeObserverAttachFixture, {
      props: {
        onResize: () => {},
      },
    });

    const [record] = FakeResizeObserver.records;

    rendered.unmount();

    expect(record?.disconnectCalls).toBeGreaterThanOrEqual(1);
  });

  test('does not observe while enabled returns false, then reconnects when it flips true', async () => {
    let enabled = false;

    const rendered = render(UseResizeObserverAttachFixture, {
      props: {
        onResize: () => {},
        options: {
          enabled: () => enabled,
        },
      },
    });

    expect(FakeResizeObserver.records).toHaveLength(0);

    enabled = true;
    await rendered.rerender({
      onResize: () => {},
      options: {
        enabled: () => enabled,
      },
    });

    expect(FakeResizeObserver.records).toHaveLength(1);
    expect(FakeResizeObserver.records[0]?.observeCalls).toHaveLength(1);

    enabled = false;
    await rendered.rerender({
      onResize: () => {},
      options: {
        enabled: () => enabled,
      },
    });

    expect(FakeResizeObserver.records[0]?.disconnectCalls).toBeGreaterThanOrEqual(1);

    enabled = true;
    await rendered.rerender({
      onResize: () => {},
      options: {
        enabled: () => enabled,
      },
    });

    expect(FakeResizeObserver.records).toHaveLength(2);
  });

  test('observes immediately when enabled is omitted', () => {
    render(UseResizeObserverAttachFixture, {
      props: {
        onResize: () => {},
      },
    });

    expect(FakeResizeObserver.records).toHaveLength(1);
  });

  test('is a safe no-op when ResizeObserver is unavailable', () => {
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    const rendered = render(UseResizeObserverAttachFixture, {
      props: {
        onResize: () => {},
      },
    });

    expect(FakeResizeObserver.records).toHaveLength(0);

    rendered.unmount();
  });
});
