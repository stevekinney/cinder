/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { TypingParticipant } from '../chat.types.ts';
import type { ConversationHistory, Message } from '../conversation-model.ts';
import type { ChatAdapter, ChatPushHandlers, ChatReadReceiptEvent } from './chat-adapter.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
class TestIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    void _callback;
    void _options;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
const intersectionObserverDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'IntersectionObserver',
);
globalThis.ResizeObserver = TestResizeObserver;
Object.defineProperty(globalThis, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: TestIntersectionObserver,
});
afterAll(() => {
  if (resizeObserverDescriptor) {
    Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
  } else {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  }
  if (intersectionObserverDescriptor) {
    Object.defineProperty(globalThis, 'IntersectionObserver', intersectionObserverDescriptor);
  } else {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  }
});

const { default: AdapterSwitchFixture } = await import('./chat-adapter-switch-fixture.svelte');

type Fixture =
  typeof AdapterSwitchFixture extends Component<any, infer Exports, any> ? Exports : never;
type CallbackOptions = Parameters<Fixture['setCallbacks']>[0];
type MountedFixture = { instance: Fixture; target: HTMLElement };

let sequence = 0;

function conversation(id: string): ConversationHistory {
  const now = new Date().toISOString();
  const messageId = `message-${++sequence}`;
  const message: Message = {
    id: messageId,
    role: 'user',
    content: 'Hello',
    position: 0,
    createdAt: now,
    metadata: {},
    hidden: false,
  };
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: [messageId],
    messages: { [messageId]: message },
    createdAt: now,
    updatedAt: now,
  };
}

function adapter(
  name: string,
  subscriptions: Array<{ name: string; handlers: ChatPushHandlers }>,
  events: string[],
): ChatAdapter {
  return {
    sendMessage: async () => {},
    subscribe: (conversationId, handlers) => {
      events.push(`subscribe:${name}:${conversationId}`);
      subscriptions.push({ name, handlers });
      return () => events.push(`teardown:${name}:${conversationId}`);
    },
  };
}

const mountedFixtures = new Set<Fixture>();

function mountFixture(
  initial: ConversationHistory,
  currentAdapter: ChatAdapter,
  callbacks: CallbackOptions = {},
  onerror?: (error: unknown) => void,
): MountedFixture {
  const target = document.createElement('div');
  document.body.append(target);
  const instance = mount(AdapterSwitchFixture, {
    target,
    props: {
      initial,
      adapter: currentAdapter,
      ...callbacks,
      ...(onerror ? { onerror } : {}),
    },
  });
  mountedFixtures.add(instance);
  return { instance, target };
}

afterEach(async () => {
  for (const instance of mountedFixtures) await unmount(instance);
  mountedFixtures.clear();
  document.body.replaceChildren();
});

describe('Chat adapter subscription owner', () => {
  test('reads replacement callbacks live without resubscribing', () => {
    const subscriptions: Array<{ name: string; handlers: ChatPushHandlers }> = [];
    const events: string[] = [];
    const oldMessages: Message[] = [];
    const newMessages: Message[] = [];
    const firstTyping: TypingParticipant[][] = [];
    const secondTyping: TypingParticipant[][] = [];
    const currentAdapter = adapter('stable', subscriptions, events);
    const initial = conversation('callback-conversation');
    const messageId = initial.ids[0]!;
    const incoming: Message = {
      id: 'incoming-message',
      role: 'assistant',
      content: 'incoming',
      position: 1,
      createdAt: new Date().toISOString(),
      metadata: {},
      hidden: false,
    };
    const firstReceipts: ChatReadReceiptEvent[] = [];
    const secondReceipts: ChatReadReceiptEvent[] = [];
    const view = mountFixture(initial, currentAdapter, {
      onPushMessage: () => oldMessages.push(incoming),
      onTypingChange: (value) => firstTyping.push(value),
      onReadReceipt: (event) => firstReceipts.push(event),
    });
    flushSync();
    view.instance.setCallbacks({
      onPushMessage: (message) => newMessages.push(message),
      onTypingChange: (value) => secondTyping.push(value),
      onReadReceipt: (event) => secondReceipts.push(event),
    });
    flushSync();
    const handlers = subscriptions[0]!.handlers;
    handlers.onMessage(incoming);
    handlers.onTypingChange([{ id: 'adapter-alice', name: 'Alice' }]);
    const receipt: ChatReadReceiptEvent = { messageId, readAt: '2026-09-16T00:00:00.000Z' };
    handlers.onReadReceipt(receipt);
    flushSync();

    expect(events).toEqual(['subscribe:stable:callback-conversation']);
    expect(oldMessages).toEqual([]);
    expect(newMessages).toEqual([incoming]);
    expect(newMessages[0]).toBe(incoming);
    expect(firstTyping).toEqual([]);
    expect(secondTyping).toEqual([[{ id: 'adapter-alice', name: 'Alice' }]]);
    expect(firstReceipts).toEqual([]);
    expect(secondReceipts).toEqual([receipt]);
  });

  test('preserves synchronous subscribe replay', () => {
    const replayed: string[] = [];
    const replayAdapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        handlers.onMessage({
          id: 'replayed',
          role: 'user',
          content: 'replayed',
          position: 1,
          createdAt: new Date().toISOString(),
          metadata: {},
          hidden: false,
        });
        return () => {};
      },
    };
    const replayView = mountFixture(conversation('replay'), replayAdapter, {
      onPushMessage: (message) => replayed.push(message.id),
    });
    void replayView;
    flushSync();
    expect(replayed).toEqual(['replayed']);
  });

  test('removing an adapter with the same conversation id resets adapter state', () => {
    const subscriptions: Array<{ name: string; handlers: ChatPushHandlers }> = [];
    const events: string[] = [];
    const currentAdapter = adapter('removable', subscriptions, events);
    const view = mountFixture(conversation('removable-conversation'), currentAdapter);
    flushSync();
    const messageId = view.target
      .querySelector('[data-message-id]')
      ?.getAttribute('data-message-id');
    if (!messageId) throw new Error('Missing mounted message id');
    const handlers = subscriptions[0]!.handlers;
    handlers.onTypingChange([{ id: 'adapter-alice', name: 'Alice' }]);
    handlers.onReadReceipt({ messageId, readAt: new Date().toISOString() });
    flushSync();
    expect(view.target.querySelector('.chat-participant-typing-label')?.textContent).toContain(
      'Alice is typing',
    );
    expect(view.target.querySelector('[data-cinder-receipt-status]')).not.toBeNull();

    view.instance.setAdapter({ sendMessage: async () => {} });
    flushSync();
    expect(view.target.querySelector('.chat-participant-typing-label')).toBeNull();
    expect(view.target.querySelector('[data-cinder-receipt-status]')).toBeNull();
  });

  test('propagates a synchronous subscribe throw without swallowing it', async () => {
    const throwingAdapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: () => {
        throw new Error('subscribe failed');
      },
    };
    const errors: unknown[] = [];
    mountFixture(conversation('subscribe-throw'), throwingAdapter, {}, (error) =>
      errors.push(error),
    );
    await Promise.resolve();
    flushSync();
    const messages = errors
      .filter((error): error is Error => error instanceof Error)
      .map((error) => error.message);
    expect(messages).toContain('subscribe failed');
  });

  test('keeps teardown invocation direct and before state cleanup', async () => {
    const source = await Bun.file(
      new URL('../container/use-chat-adapter-subscription.svelte.ts', import.meta.url),
    ).text();
    const unsubscribeIndex = source.indexOf(
      "if (typeof unsubscribe === 'function') unsubscribe();",
    );
    const streamingResetIndex = source.indexOf(
      'options.getStreamingActions().endStreaming();',
      unsubscribeIndex,
    );
    expect(unsubscribeIndex).toBeGreaterThan(-1);
    expect(streamingResetIndex).toBeGreaterThan(unsubscribeIndex);
    expect(source).not.toContain('try {');
  });
});
