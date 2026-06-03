/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: UseMutationObserverAttachFixture } =
  await import('../test/fixtures/use-mutation-observer-attach-fixture.svelte');

type ObserverRecord = {
  callback: MutationCallback;
  init: MutationObserverInit | undefined;
  observeCalls: { target: Element; init: MutationObserverInit | undefined }[];
  disconnectCalls: number;
};

class FakeMutationObserver {
  static records: ObserverRecord[] = [];

  private readonly record: ObserverRecord;

  constructor(callback: MutationCallback) {
    this.record = {
      callback,
      init: undefined,
      observeCalls: [],
      disconnectCalls: 0,
    };
    FakeMutationObserver.records.push(this.record);
  }

  observe(target: Element, init?: MutationObserverInit) {
    this.record.init = init;
    this.record.observeCalls.push({ target, init });
  }

  disconnect() {
    this.record.disconnectCalls += 1;
  }

  takeRecords(): MutationRecord[] {
    return [];
  }
}

const originalMutationObserver = globalThis.MutationObserver;

function createMutationRecord(target: Element): MutationRecord {
  return {
    type: 'childList',
    target,
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  };
}

beforeEach(() => {
  FakeMutationObserver.records = [];
  globalThis.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver;
});

afterEach(() => {
  cleanup();
  globalThis.MutationObserver = originalMutationObserver;
});

describe('useMutationObserver', () => {
  test('constructs an observer with the provided init options', () => {
    const { getByTestId } = render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: () => {},
        options: {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'disabled'],
        },
      },
    });

    const sentinel = getByTestId('sentinel');
    const [record] = FakeMutationObserver.records;

    expect(record?.observeCalls).toHaveLength(1);
    expect(record?.observeCalls[0]?.target).toBe(sentinel);
    expect(record?.init).toEqual({
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled'],
    });
  });

  test('invokes the callback with the mutations array', () => {
    const seen: Element[] = [];
    const { getByTestId } = render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: (mutations: MutationRecord[]) => {
          for (const mutation of mutations) {
            seen.push(mutation.target as Element);
          }
        },
        options: { childList: true },
      },
    });

    const sentinel = getByTestId('sentinel');
    const [record] = FakeMutationObserver.records;

    record?.callback([createMutationRecord(sentinel)], {} as MutationObserver);

    expect(seen).toEqual([sentinel]);
  });

  test('ignores queued observer entries after enabled flips false', async () => {
    let enabled = true;
    const seen: Element[] = [];

    const rendered = render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: (mutations: MutationRecord[]) => {
          for (const mutation of mutations) {
            seen.push(mutation.target as Element);
          }
        },
        options: {
          childList: true,
          enabled: () => enabled,
        },
      },
    });

    const sentinel = rendered.getByTestId('sentinel');
    const [record] = FakeMutationObserver.records;

    enabled = false;
    await rendered.rerender({
      onMutate: (mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
          seen.push(mutation.target as Element);
        }
      },
      options: {
        childList: true,
        enabled: () => enabled,
      },
    });

    record?.callback([createMutationRecord(sentinel)], {} as MutationObserver);

    expect(seen).toEqual([]);
  });

  test('disconnects when the attachment is destroyed', () => {
    const rendered = render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: () => {},
        options: { childList: true },
      },
    });

    const [record] = FakeMutationObserver.records;

    rendered.unmount();

    expect(record?.disconnectCalls).toBeGreaterThanOrEqual(1);
  });

  test('does not observe while enabled returns false, then reconnects when it flips true', async () => {
    let enabled = false;

    const rendered = render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: () => {},
        options: {
          childList: true,
          enabled: () => enabled,
        },
      },
    });

    expect(FakeMutationObserver.records).toHaveLength(0);

    enabled = true;
    await rendered.rerender({
      onMutate: () => {},
      options: {
        childList: true,
        enabled: () => enabled,
      },
    });

    expect(FakeMutationObserver.records).toHaveLength(1);
    expect(FakeMutationObserver.records[0]?.observeCalls).toHaveLength(1);

    enabled = false;
    await rendered.rerender({
      onMutate: () => {},
      options: {
        childList: true,
        enabled: () => enabled,
      },
    });

    expect(FakeMutationObserver.records[0]?.disconnectCalls).toBeGreaterThanOrEqual(1);

    enabled = true;
    await rendered.rerender({
      onMutate: () => {},
      options: {
        childList: true,
        enabled: () => enabled,
      },
    });

    expect(FakeMutationObserver.records).toHaveLength(2);
  });

  test('observes immediately when enabled is omitted', () => {
    render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: () => {},
        options: { childList: true },
      },
    });

    expect(FakeMutationObserver.records).toHaveLength(1);
  });

  test('is a safe no-op when MutationObserver is unavailable', () => {
    globalThis.MutationObserver = undefined as unknown as typeof MutationObserver;

    const rendered = render(UseMutationObserverAttachFixture, {
      props: {
        onMutate: () => {},
        options: { childList: true },
      },
    });

    expect(FakeMutationObserver.records).toHaveLength(0);

    rendered.unmount();
  });
});
